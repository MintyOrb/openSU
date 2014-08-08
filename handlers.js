var bcrypt = require('bcrypt'),
	requestModule = require("request"),
    querystring = require('querystring'),
    fs = require("fs"),
    neo4j = require('neo4j'),
    db = new neo4j.GraphDatabase(process.env.GRAPHENEDB_URL || 'http://localhost:7474'),
    freebase = require('freebase'),
    async = require('async'),
    uuid = require('node-uuid'),
    webshot = require('webshot'),
    youtube = require('youtube-node'),
    AWS = require('aws-sdk'),
    s3 = new AWS.S3();

youtube.setKey('AIzaSyCrHUlKm60rk271WLK58cZJxEnzqNwVCw4');

//auth and sessions

exports.authUser = function (email, password, done) {
    
    var properties = { email: email };
    var query = 'MATCH (memberNode:member {primaryEmail: {email} }) RETURN memberNode.passwordHash AS pass, memberNode.UUID AS id';

    db.query(query, properties, function (err, userInfo) {
        if (err) {console.log("error in db query: " + err);}
        if(userInfo[0] === undefined){
            return done(null, false, { message : 'Incorrect email.' });// message does not work
        }

        bcrypt.compare(password, userInfo[0].pass, function(err, res) {
            if (err) { return done(err); }
            if (res !== true) {
                return done(null, false, { message: 'Incorrect password.' });// message does not work
            }
            return done(null, userInfo);
        });
    });    
};

exports.logout = function (request, reply) {
    request.session._logOut();
    reply({message:'logged out'});
};

//new user
exports.addAccount = function (request, reply) {

    var createProperties = {
        props: {
            primaryEmail : request.payload.email,
            dateJoined : new Date(),
            UUID : uuid.v4(),
            codeUsed : request.payload.code
        } 
    };
    var createQuery = 'CREATE (memberNode:member:temp { props } )';
    
    var codeProp = {code: request.payload.code};
    var codeQuery = "MATCH (n:codeNode {code: {code} }) SET n.count = n.count + 1 RETURN n";

    var checkProperites = {email: request.payload.email};
    var checkQuery = 'MATCH (memberNode:member:temp { primaryEmail: {email} } ) RETURN memberNode.primaryEmail as email';

    async.series([

        //check if email already exists
        function(callback){
            db.query(checkQuery, checkProperites, function (err, results) {
                if (err) {console.log("error: " + err);}
                if (results[0] === undefined){
                    callback();
                } else{
                    reply({message: "email address already registered."});
                    callback(true); //passing 'true' stops async series execution
                }
            });
        },

        //check if code is valid
        function(callback){
            db.query(codeQuery, codeProp, function (err, results) {
                if (err) {console.log("error: " + err);}
                if (results[0] === undefined){ // reply with error if code is not found
                    reply({message: "code not recognized."});
                    callback(true);
                } else{
                    callback();
                }
            });
        },

        //create hash from supplied password
        function(callback){
            bcrypt.genSalt(10, function(err, salt) {
                bcrypt.hash(request.payload.password, salt, function(err, hash) {
                    createProperties.props.passwordHash = hash;
                    callback();
                });
            });
        },

        //create and store new member node in DB
        function(callback){
            db.query(createQuery, createProperties, function (err, results) {
                if (err) {throw err;}
                reply({successfulCreation: true});
                callback(true);
            });
        }
    ]);
   
};



















//new terms
exports.addTerm = function (request, reply) {
    console.log("add term called: " );
    // TODO: determine how to handle definion in case en vs en-gb - remove region specification (gb)?
    // right now its just adding all as they come in
    
    var UUID = uuid.v4(); // Unique ID for term being added

    // used to get term name in as many languages as possible
    var freebasQuery={
          "mid": request.payload.mid,
          "type": "/common/topic",
          "name": [{}]
        };

    var createProperties = {
            "coreProps" : {
                "MID": request.payload.mid,
                "dateAdded": new Date(),
                "addedBy" : request.user.id,
                "UUID": UUID,
                "languageAddedIn" : request.payload.lang,
            },
            "metaProps" : [], // array of objects (created below)
        };

    var termGroupProperties = { 
        termUUID: UUID,
        groups: [] 
    };


    // generate array of term group names
    for (var group in request.payload.groups) {
        if(request.payload.groups[group].included) {
            termGroupProperties.groups.push(request.payload.groups[group].name);
        }
    }


    var metaProp = {}; // for storing result of MQL query (will be pushed to createProperties.metaProps)
    var defMeta = "";  // for adding definition provided in adders language

    var createQuery = [
        "CREATE (newTerm:term:testTerm {coreProps}) ",
        "FOREACH ( props IN {metaProps} | ",
        "CREATE newTerm-[:HAS_LANGUAGE {languageCode: props.languageCode}]->(:termMeta:testMeta {name: props.name, dateAdded: props.dateAdded, definition: props.definition}) )"
    ].join("\n"); //  if returning data from query use: WITH newTerm MATCH newTerm-[rel:HAS_META]->(metaNode:test:termMeta) RETURN newTerm, rel, metaNode";
    
    var connectGroupsQuery = [
        "MATCH (groupNode:termGroup), (termNode:term {UUID: {termUUID} }) ",
        "WHERE groupNode.name IN {groups} ",
        "CREATE (groupNode)<-[:IN_GROUP]-(termNode) ",
        "RETURN groupNode, termNode"
    ].join("\n");

    
    // used to see if term is already in the database
    var checkQuery = "MATCH (node:term {MID: {mid} }) RETURN node.UUID as UUID";
    var checkProperties = {mid: request.payload.mid};
    
    async.series([
        
        // check if term is already in database (search by MID)
        function(callback){
            db.query(checkQuery, checkProperties, function (err, results) {
                if (err) {console.log("error performing db query: " + err);}
                if (results[0] === undefined){
                    console.log("term not already in db: ");
                    callback();
                } else{
                    console.log("term found: " );
                    console.log(results[0]);
                    reply({newTerm: false, UUID: results[0].UUID});
                    callback(true); // if already found, stop execution of functions
                }
            });
        },

        // MQL query for termMeta, build meta from results
        function(callback){
            freebase.mqlread(freebasQuery, {key:"AIzaSyCrHUlKm60rk271WLK58cZJxEnzqNwVCw4"}, function(result){
                // for each language found, add name to metaProp
                for(var ii = 0; ii<result.result.name.length; ii++){
                
                    // add def to termMeta of correct language
                    if(result.result.name[ii].lang.substr(6,result.result.name[ii].lang.length) === request.payload.lang){
                        defMeta = request.payload.definition || "";
                    }
                    metaProp = {
                        languageCode: result.result.name[ii].lang.substr(6,result.result.name[ii].lang.length), //get rid of "/lang/"
                        name: result.result.name[ii].value,
                        dateAdded: new Date(),
                        definition: defMeta
                    };
        
                    createProperties.metaProps.push(metaProp);
                    defMeta = ""; // reset def so it is not added in incorrect languages
                }
                console.log("made meta (translations) : ");
                callback();   
            });
        },
        
        //add term and respective term meta in all avaialble languages on freebase to graph, return UUID
        function(callback){
            db.query(createQuery, createProperties, function (err, results) {
                if (err) {console.log("neo4j error: " + err);}
                console.log("successfully added term: ");
                callback();
            });
        },
        //add relationships to relevant term groups
        function(callback){
            db.query(connectGroupsQuery, termGroupProperties, function (err, results) {
                if (err) {console.log("neo4j error: " + err);}
                console.log("connected term to groups: " );
                reply({newTerm: true, UUID: UUID});
                callback();
                
            });
        }
    ]);

};



exports.termTypeAhead = function (request, reply){

    var properties = { 
        code: request.query.language,
        match: '(?i).*' + request.query.entered + '.*'
     };
    //TODO: use english as default if not found in preferred language
    //TODO: use users secondary languge choice if first not found?
    //TODO: search for aliases of term?
    // var query = [
    //     "MATCH (contentNode:content)-[:TAGGED_WITH]-(core:term)-[r:HAS_LANGUAGE {languageCode:{code}}]-(langNode) ",
    //     "WHERE langNode.name =~ {match} ",
    //     "RETURN core.UUID as UUID, langNode.name as name, count(DISTINCT contentNode) AS connections LIMIT 8"
    // ].join('\n');
    var query = [
        "MATCH (core:term)-[r:HAS_LANGUAGE {languageCode:{code}}]-(langNode) ",
        "WHERE langNode.name =~ {match} ",
        "RETURN core.UUID as UUID, langNode.name as name LIMIT 8"
    ].join('\n');

    db.query(query, properties, function (err, matches) {
        if (err) {console.log("error in db query: " + err);}
        if(matches[0] === undefined){
            reply({ matches : [], results: false });
        } else {
            reply({matches:matches, results: true });
        }
    });    
};

exports.relatedTerms = function (request, reply) {
    
    // TODO: compare query speed of other term type methods (as labels, as properties...)
    // TODO: improve method of matching terms

    var matchAllTerms;
    var query = "";
    var properties = {
        language: request.payload.language ,
        ignoreTerms: [],
        searchTerms: [],
        // groups: [],
        searchTermsCount: 0

    };

    if(request.payload.matchAll !== undefined){
        matchAllTerms = request.payload.matchAll;
    } else {
        matchAllTerms = true;
    }

    if(request.payload.keyTerms.length === 0){
        //return most connected terms if no key terms selected
        // query = [
        //     'MATCH (groupNode:termGroup)<-[:IN_GROUP]-(matched:term)<-[:TAGGED_WITH]-(contentNode:content), ',
        //         '(matched)-[:HAS_LANGUAGE {languageCode: {language} }]-(termMeta:termMeta) ',
        //     'WHERE',
        //         'groupNode.name IN {groups} ',
        //         'AND NOT matched.UUID IN {ignoreTerms} ',
        //     'RETURN DISTINCT count(DISTINCT contentNode) AS connections, termMeta.name AS name, matched.UUID AS UUID ',
        //     'ORDER BY connections DESC LIMIT 10'
        // ].join('\n');
        
        // don't worry about term groups
        query = [
            'MATCH (matched:term)<-[:TAGGED_WITH]-(contentNode:content), ',
                '(matched)-[:HAS_LANGUAGE {languageCode: {language} }]-(termMeta:termMeta) ',
            'WHERE',
                
                'NOT matched.UUID IN {ignoreTerms} ',
            'RETURN DISTINCT count(DISTINCT contentNode) AS connections, termMeta.name AS name, matched.UUID AS UUID ',
            'ORDER BY connections DESC LIMIT 10'
        ].join('\n');

    } else {
        if(matchAllTerms){
            // query = [
            //     'MATCH (contentNode:content)-[:TAGGED_WITH]->(searchTerms:term) ',
            //     'WHERE searchTerms.UUID IN {searchTerms} ',
            //     'WITH contentNode, COUNT(searchTerms) as count ',
            //     'WHERE count = {searchTermsCount} ',
            //     'MATCH (groupNode:termGroup)<-[:IN_GROUP]-(matched:term)<-[:TAGGED_WITH]-contentNode, ',
            //         'matched-[:HAS_LANGUAGE {languageCode: {language} }]->(termMeta:termMeta) ',
            //     'WHERE groupNode.name IN {groups} AND NOT matched.UUID IN {ignoreTerms} ',    
            //     'RETURN DISTINCT count(DISTINCT contentNode) AS connections, termMeta.name AS name, matched.UUID AS UUID ',
            //     'ORDER BY connections DESC LIMIT 10'
            // ].join('\n');
            
            // don't worry about term groups
            query = [
                'MATCH (contentNode:content)-[:TAGGED_WITH]->(searchTerms:term) ',
                'WHERE searchTerms.UUID IN {searchTerms} ',
                'WITH contentNode, COUNT(searchTerms) as count ',
                'WHERE count = {searchTermsCount} ',
                'MATCH (matched:term)<-[:TAGGED_WITH]-contentNode, ',
                    'matched-[:HAS_LANGUAGE {languageCode: {language} }]->(termMeta:termMeta) ',
                'WHERE NOT matched.UUID IN {ignoreTerms} ',    
                'RETURN DISTINCT count(DISTINCT contentNode) AS connections, termMeta.name AS name, matched.UUID AS UUID ',
                'ORDER BY connections DESC LIMIT 10'
            ].join('\n');
        } else {
            // match any 
            query = [
                'MATCH (groupNode:termGroup)<-[:IN_GROUP]-(matched:term)<-[:TAGGED_WITH]-(contentNode:content)-[:TAGGED_WITH]->(searchTerms:term), ',
                    '(matched)-[:HAS_LANGUAGE {languageCode: {language} }]-(termMeta:termMeta) ',
                'WHERE',
                    'groupNode.name IN {groups} ',
                    'AND searchTerms.UUID IN {searchTerms} ',
                    'AND NOT matched.UUID IN {ignoreTerms} ',
                'RETURN DISTINCT count(DISTINCT contentNode) AS connections, termMeta.name AS name, matched.UUID AS UUID ',
                'ORDER BY connections DESC LIMIT 10'
            ].join('\n');
        }
    }
     // add UUIDs from key terms to ignore and key term arrays
    for (var i = 0; i < request.payload.keyTerms.length; i++) {
        properties.searchTermsCount += 1;
        properties.ignoreTerms.push(request.payload.keyTerms[i].UUID);
        properties.searchTerms.push(request.payload.keyTerms[i].UUID);
    }

    // add filters to group array
    for (var group in request.payload.groups) {
        if(request.payload.groups[group].included){
            properties.groups.push(request.payload.groups[group].name);
        }
    }
    for (var term in request.payload.ignoreTerms) {
        properties.ignoreTerms.push(request.payload.ignoreTerms[term].UUID);    
    }


    db.query(query, properties, function (err, results) {
        if (err) {throw err;}
        reply({results: results});
    });
};


exports.getTermGroups = function(request, reply){

    var properties = {
        id : request.query.uuid
    };

    var query = [
        "MATCH (termNode:term {UUID: {id} })-[r:IN_GROUP]->(groupNode:termGroup) ",
        "RETURN groupNode.name AS name"
    ].join('\n');

    db.query(query, properties, function (err, results) {
        if (err) {throw err;}
        reply(results);
    });
};

exports.setTermGroups = function(request, reply){

    // TODO: log changes made and by whom - record date, user id, changes - as seperate node?
    var properties = {
        id: request.payload.uuid,
        newGroups: [],
        date: new Date(),
        userID: request.user[0].id
    };
    
    for(var group in request.payload.groups) {
        if(request.payload.groups[group].included){
            properties.newGroups.push(request.payload.groups[group].name);
        }
    }

    var query = [
        "MATCH  (termNode:term {UUID: {id} }) ",
        "OPTIONAL MATCH termNode-[r:IN_GROUP]->(oldGroups:termGroup) ",
        "DELETE r ",
        "WITH termNode ",
        "MATCH (newGroups:termGroup) ",
        "WHERE newGroups.name IN {newGroups} ",
        "CREATE UNIQUE (termNode)-[:IN_GROUP]->(newGroups) ",
    ].join('\n');  

    db.query(query, properties, function (err, results) {
        if (err) {
            reply({success:false});
            throw err;
        } else {
            reply({success:true});
        }
    });
};














//new content
exports.addContentFromURL = function (request, reply){  

    var ext = request.payload.url.split('.').pop();     // get extension from orignal filename image files only)
    var generatedName = uuid.v1();                      // is uuid the best option for file names?
    var lang = "_" + request.payload.language + "_";    // allows for adding same content in different languages

    var embedURL = ""; // for setting embedded video source urls
    var parsedQuerystring = ""; //for extracting youtube video id
    var thumbURL = ""; // holds url of thumbnail
    var thumbData; // for holding video thumbnail data

    //get response header to determine type of url
    requestModule.head({uri:request.payload.url}, function (error, response) {
        if(error){console.log("error on head request: " + error);}

        if(response.statusCode !== 200){
            reply().code(500);
        } else if (response.headers['content-type'].indexOf('image') > -1){
            // save to s3
           
            requestModule(request.payload.url).pipe(fs.createWriteStream("./public/img/temp/" + lang + generatedName + '.' + ext)
            .on('finish', function(){ 
                fs.readFile("./public/img/temp/" + lang + generatedName + '.' + ext, function(err, data){
                    if (err) { console.warn(err); }
                    else {

                        s3.putObject({
                            Bucket: "singularity_bucket",
                            Key:  lang + generatedName + '.' + ext,
                            Body: data,
                            ACL: 'public-read', 
                            ContentType: response.headers['content-type'], //save gifs as text for gif scrolling?
                        }, function(err, data) {
                            if (err) {
                                console.log(err, err.stack);
                            } else {
                                reply({savedAs: lang + generatedName + '.' + ext, embedSrc: "", id: generatedName, displayType: "image"});
                            }
                        });
                        
                    }
                });  

            }));

          
        } else {
            // determine if video and host or website
            // NOTE: is this the best way to make the source determination?
            // TODO: incorporate youtube, vimeo, and TED (when available) apis to get thumbnail images
            // 
            if(response.request.uri.host.indexOf('ted.com') > -1){
                //embed - //embed.ted.com/talks/:id
                embedURL = "//embed.ted.com";
                embedURL += response.request.uri.path;
                reply({savedAs:'videoIcon.png',embedSrc: embedURL, id: "", displayType: "embed"});
            } else if(response.request.uri.host.indexOf('vimeo.com') > -1){
                //embed - //www.player.vimeo.com/video/:id
                embedURL = "//player.vimeo.com/video";
                embedURL += response.request.uri.path;
                reply({savedAs:'videoIcon.png',embedSrc: embedURL, id: "", displayType: "embed"});
            } else if(response.request.uri.host.indexOf('youtube.com') > -1){
                parsedQuerystring = querystring.parse(response.request.uri.query);
                //embed - //www.youtube.com/embed/:id
                embedURL = "//www.youtube.com/embed/";
                embedURL += parsedQuerystring.v;

                // if it's a youtube video, use youtube api to save a thumbnail for the image
                async.series([
            
                    // get video thumbnail url
                    function(callback){
                        youtube.getById(parsedQuerystring.v, function(resultData) {
                            thumbURL = resultData.items[0].snippet.thumbnails.medium.url;
                            callback();
                        });
                    },   
                    // save thumb data to disk in temp folder
                    function(callback){
                        requestModule(thumbURL).pipe(fs.createWriteStream("./public/img/temp/" + lang + generatedName + ".jpg")
                            .on('finish', function(){ 
                                console.log("successfully saved thumb to disk: " );
                                callback();
                            })
                        );
                    }, 

                    // get the image data of the thumbnail
                    function(callback){
                        fs.readFile("./public/img/temp/" + lang + generatedName + '.jpg', function(err, data){
                            if (err) { 
                                console.warn(err); 
                                //TODO: reply with error?
                            } else {
                                thumbData = data;
                                callback();
                            }
                        });
                    }, 

                    //save thumbnail to s3
                    function(callback){
                        s3.putObject({
                            Bucket: "singularity_bucket",
                            Key:  lang + generatedName + '.jpg',
                            Body: thumbData,
                            ACL: 'public-read', 
                            ContentType: "image/jpeg",
                        }, function(err, data) {
                            if (err) {
                                console.log(err, err.stack);
                                // TODO: reply w/ error?
                            } else {
                                callback();
                            }
                        });
                    },

                    // send reply to user
                    function(callback){
                        console.log("embedurl: " + embedURL);
                        reply({savedAs: lang + generatedName + '.jpg', embedSrc: embedURL, id: generatedName, displayType: "embed"});
                    }

                ]);

            } else {
    
                //take screenshot of webpage that is not a video
                webshot(request.payload.url, './public/img/temp/' + lang + generatedName + '.png',function(err) {
                    if(err){
                        reply('error').code(500);
                    } else {
                        console.log("website here: ");
                        fs.readFile("./public/img/temp/" + lang + generatedName + '.png', function(err, data){
                            if (err) { console.warn(err); } else {
                                s3.putObject({
                                    Bucket: "singularity_bucket",
                                    Key:  lang + generatedName + '.png',
                                    Body: data,
                                    ACL: 'public-read',
                                    ContentType: 'image/png',
                                }, function(err, data) {
                                    if (err) {
                                        console.log(err, err.stack);
                                    } else {
                                        console.log('success! ' + data);
                                        reply({savedAs: lang + generatedName + '.png', embedSrc: "",id: generatedName, displayType: "webpage"});
                                    } 
                                });
                            }
                        });
                    }
                });
            }
        } 
    });
};

exports.addImageFile = function (request, reply){
    // uploaded from members computer
    //TODO: validate incoming file is an image
    //TODO: look into converting gifs to html5 videos (gfycat...)
    var ext = request.payload.name.split('.').pop();    //get extension from orignal filename
    var generatedName = uuid.v1();                      //NOTE: is uuid the best option for unique file names?
    var lang = "_" + request.payload.language + "_";    //allows for adding same content in different languages (keep same UUID)
   
    s3.putObject({
        Bucket: "singularity_bucket",
        Key:  lang + generatedName + '.' + ext,
        Body: request.payload.file,
        ACL: 'public-read',
        ContentType: request.payload.type,
    }, function(err, data) {
        if (err) {
            console.log(err, err.stack);
        } else {
            reply({displayType:"image", savedAs: lang + generatedName + '.' + ext, id: generatedName});
        } 
    });
    
};

exports.addNewContent = function (request, reply){

    var genUUID = uuid.v4();
    
    //query for creating the content and relationships to tagged terms
    var query = [
        "CREATE (contentNode:content:testContent:testtest {contentParams})-[r:HAS_META {languageCode: {lang} }]->(metaNode:contentMeta {metaParams}) ",
        "WITH contentNode MATCH (termNode:term) ",
        "WHERE termNode.UUID IN {taggedTermsUUID} ",
        "CREATE (contentNode)-[:TAGGED_WITH]->(termNode)"
    ].join('\n');

    var params = {
        contentParams: {
            UUID: genUUID,
            dateAdded: new Date(),
            languageAddedIn: request.payload.language,
            displayType: request.payload.displayType,
            fileSystemID: request.payload.fileSystemID, 
            embedSrc: request.payload.embedSrc, 
            webURL: request.payload.webURL,
            savedAs: request.payload.savedAs, 
        },
        taggedTermsUUID: [],
        lang: request.payload.language,
        metaParams: request.payload.meta
    };

    //populate term UUID array
    for (var i = 0; i < request.payload.assignedTerms.length; i++) {
        params.taggedTermsUUID.push(request.payload.assignedTerms[i].UUID);
    }

    db.query(query, params, function (err, results) {
        if (err) {console.log("neo4j error: " + err);}
        reply({UUID:genUUID}); 
    });

};



exports.relatedContent = function (request, reply){

    var query = '';
    var id = null;
    var member = false;    
    var count = 0;
    var orderBy = "";

    if(request.user !== undefined){
        id = request.user[0].id;
        member = true;
    }

    var properties = {
        language: request.payload.language,  // first choice
        defaultLanguage: 'en',               // default to english
        includedTerms: [],
        excludedTerms: [],
        userID: id,
        numberOfIncluded: count,
        skip: request.payload.skip,
        orderBy: orderBy
    };

    // TODO: consider merging filesystemID, weburl, and embedSrc into one property
    if(request.payload.includedTerms.length === 0){
        query = [
            "MATCH (meta:contentMeta)<-[metaLang:HAS_META]-(content:content)-[:TAGGED_WITH]->(termNode:term)-[lang:HAS_LANGUAGE]->(langNode:termMeta) ",
            "WHERE ",
                "metaLang.languageCode IN [ {language} , {defaultLanguage} ] ",
                "AND lang.languageCode IN [ {language} , {defaultLanguage} ] ",
            'RETURN DISTINCT  collect( {termID: termNode.UUID, meta: {name: langNode.name, language: lang.languageCode } } ) AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value',
            // "WITH collect(DISTINCT termNode.UUID) AS termIDs, collect(langNode.name) as names, collect(lang.languageCode) as codes, content, meta ",            
            // 'RETURN DISTINCT  {termID: termIDs, name: names, language: codes } AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value',
            // 'ORDER BY',
            'SKIP {skip}',
            'LIMIT 15'
        ].join('\n');
        // query = [
        //     "MATCH (content:content)-[:TAGGED_WITH]->(termNode:term)-[lang:HAS_LANGUAGE]->(langNode:termMeta) ",
        //     "WHERE ",
        //         // "metaLang.languageCode IN [ {language} , {defaultLanguage} ] ",
        //         " lang.languageCode IN [ {language} , {defaultLanguage} ] ",
        //     'RETURN DISTINCT  collect( {termID: termNode.UUID, meta: {name: langNode.name, language: lang.languageCode } } ) AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID ',
        //     // "WITH collect(DISTINCT termNode.UUID) AS termIDs, collect(langNode.name) as names, collect(lang.languageCode) as codes, content, meta ",            
        //     // 'RETURN DISTINCT  {termID: termIDs, name: names, language: codes } AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value',
        //     // 'ORDER BY',
        //     'SKIP {skip}',
        //     'LIMIT 15'
        // ].join('\n');
        // query = [
        //     "MATCH (content:content) ",
        //     'RETURN DISTINCT  content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, content.dateAdded AS date ',
        //     // "WITH collect(DISTINCT termNode.UUID) AS termIDs, collect(langNode.name) as names, collect(lang.languageCode) as codes, content, meta ",            
        //     // 'RETURN DISTINCT  {termID: termIDs, name: names, language: codes } AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value',
        //     'ORDER BY date DESC ',
        //     'SKIP {skip}',
        //     'LIMIT 15'
        // ].join('\n');
    } else if(member){
        console.log("member query was run: ");
        // query = [
        //     "MATCH (user:member {UUID: {userID} }), (meta:contentMeta)<-[metaLang:HAS_META]-(content:content)-[:TAGGED_WITH]-(termNode:term) ",
        //     "WHERE ",
        //         "metaLang.languageCode IN [ {language} , {defaultLanguage} ] ",
        //         "AND NOT (user)-[:BLOCKED]-(content) ",
        //         'AND termNode.UUID IN {includedTerms} ',
        //         'AND NOT termNode.UUID IN {excludedTerms}',
        //     "WITH content, count(*) AS connected, meta ",
        //     "MATCH (content)-[:TAGGED_WITH]-(termNode:term)-[lang:HAS_LANGUAGE]-(langNode:termMeta) ",
        //     "WHERE ",
        //         "connected = {numberOfIncluded} ",
        //         "AND lang.languageCode IN [ {language} , {defaultLanguage} ] ",
        //     'RETURN DISTINCT  collect( {termID: termNode.UUID, meta: {name: langNode.name, language: lang.languageCode } } ) AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value, content.dateAdded AS dateAdded',
        //     // 'ORDER BY dateAdded DESC',
        //     'SKIP {skip}',
        //     'LIMIT 15'
        // ].join('\n');
        query = [
            "MATCH (user:member {UUID: {userID} }), (content:content)-[:TAGGED_WITH]-(termNode:term) ",
            "WHERE ",
                // "metaLang.languageCode IN [ {language} , {defaultLanguage} ] ",
                " NOT (user)-[:BLOCKED]-(content) ",
                'AND termNode.UUID IN {includedTerms} ',
                'AND NOT termNode.UUID IN {excludedTerms}',
            // "WITH content, count(*) AS connected, meta ",
            "WITH content, count(*) AS connected ",
            "MATCH (content)-[:TAGGED_WITH]-(termNode:term)-[lang:HAS_LANGUAGE]-(langNode:termMeta) ",
            "WHERE ",
                "connected = {numberOfIncluded} ",
                "AND lang.languageCode IN [ {language} , {defaultLanguage} ] ",
            // 'RETURN DISTINCT  collect( {termID: termNode.UUID, meta: {name: langNode.name, language: lang.languageCode } } ) AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value, content.dateAdded AS dateAdded',
            'RETURN DISTINCT  collect( {termID: termNode.UUID, meta: {name: langNode.name, language: lang.languageCode } } ) AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, content.dateAdded AS dateAdded',
            // 'ORDER BY dateAdded DESC',
            'SKIP {skip}',
            'LIMIT 15'
        ].join('\n');

    } else {
        query = [
            "MATCH (meta:contentMeta)<-[metaLang:HAS_META {languageCode: {language} }]-(content:content)-[:TAGGED_WITH]-(termNode:term) ",
            "WHERE ",
                "metaLang.languageCode IN [ {language} , {defaultLanguage} ] ",
                'AND termNode.UUID IN {includedTerms} ',
            "WITH content, count(*) AS connected, meta ",
            "MATCH (content)-[:TAGGED_WITH]-(termNode:term)-[lang:HAS_LANGUAGE {languageCode: {language} }]-(langNode:termMeta) ",
            "WHERE ",
                "connected = {numberOfIncluded} ",
                "AND lang.languageCode IN [ {language} , {defaultLanguage} ] ",
            'RETURN DISTINCT  collect( {termID: termNode.UUID, meta: {name: langNode.name, language: lang.languageCode } } ) AS terms, content.displayType AS displayType, content.savedAs AS savedAs, content.webURL AS webURL, content.embedSrc AS embedsrc, content.UUID AS UUID, meta.description AS description, meta.title AS title, meta.value AS value',
            // 'ORDER BY'
            'SKIP {skip}',
            'LIMIT 15'
        ].join('\n');
    }
    
    // add UUIDs from included terms to included array
    for (var i = 0; i < request.payload.includedTerms.length; i++) {
        properties.includedTerms.push(request.payload.includedTerms[i].UUID);
        count += 1;
    }
    // add UUIDs from excluded terms to excluded array
    for ( i = 0; i < request.payload.excludedTerms.length; i++) {
        properties.excludedTerms.push(request.payload.excludedTerms[i].UUID);
        // count += 1;
    }
    console.log(properties);
    properties.numberOfIncluded = count;
    db.query(query, properties, function (err, results) {
        if (err) {throw err;}
        reply(results);
    });

};

exports.getContent = function (request, reply){
    // TODO: handle returning same content in different languages (_lang_uuid)

    // TODO: increase view count by one
    var query = [
        "MATCH (meta:contentMeta)<-[r:HAS_META]-(contentNode:content {UUID: {id} }) ",
        'WHERE r.languageCode IN [{language}, "en"]',
        'RETURN contentNode.displayType AS displayType, contentNode.savedAs AS savedAs, contentNode.webURL AS webURL, contentNode.embedSrc AS embedSrc '
    ].join('\n');

    var properties = { 
        id: request.params.uuid,
        language: request.query.language,
    };
    db.query(query, properties, function (err, content) {
        if (err) {console.log("error in db query: " + err);}
        if(content === undefined){
            reply({ message : 'content not found' });
        } else {
            reply(content);
        }
    });   
};

exports.getContentTerms = function (request, reply){

    var query = "MATCH (metaNode:termMeta)-[:HAS_LANGUAGE { languageCode: { language } }]-(termNode:term)-[:TAGGED_WITH]-(contentNode:content {UUID: {id} }) RETURN metaNode.name AS name, termNode.UUID AS UUID";
    var properties = { 
        id: request.params.uuid,
        language: request.query.language,
    };

    db.query(query, properties, function (err, content) {
        if (err) {console.log("error in db query: " + err);}
        if(content[0] === undefined){
            reply({ message : 'content not found' });
        } else {
            reply(content);
        }
    });   
};
exports.updateContentTerms = function (request, reply){
    // TODO: log changes made and by whom - record date, user id, changes

    var properties = {
        contentID: request.params.uuid,
        termIDs: [],
        date: new Date(),
        userID: request.user[0].id
    };

    // TODO: strip lang from UUID if present


    for(var term in request.payload.newTerms) {
        properties.termIDs.push(request.payload.newTerms[term].UUID);
    }
    var query = [
        "MATCH (contentNode:content {UUID: {contentID} }), (newTermNode:term) ",
        "WHERE newTermNode.UUID IN {termIDs} ",
        "CREATE UNIQUE contentNode-[:TAGGED_WITH]->newTermNode ",
        "WITH DISTINCT contentNode",
        "MATCH contentNode-[r:TAGGED_WITH]->(oldTermNode:term) ",
        "WHERE NOT oldTermNode.UUID IN {termIDs} ",
        "DELETE r ",
    ].join('\n');  

    db.query(query, properties, function (err, results) {
        if (err) {
            reply({success:false});
            throw err;
        } else {
            reply({success:true});
        }
    });
};

exports.getContentAbout = function (request, reply){
 
    var query = [
        "MATCH (contentNode:content {UUID: {id} })-[r:HAS_META]-(metaNode:contentMeta) ",
        'WHERE r.languageCode IN [{language}, "en"]',
        "RETURN metaNode.value AS value, metaNode.description AS description, metaNode.title AS title "
        ].join('\n'); 
    var properties = { 
        id: request.query.uuid,
        language: request.query.language,
    };

    db.query(query, properties, function (err, about) {
        if (err) {console.log("error in db query: " + err);}
            reply({value:about[0].value || "",description:about[0].description || "",title:about[0].title || ""});
    });   
};


exports.addFact = function (request, reply){
    
};





exports.requestCode = function(request, reply){

    var query = 'CREATE (n:requestCode {reason: {reason}, email:{email}} ) RETURN n';
    var properties = { 
        reason: request.payload.reason,
        email: request.payload.email,
        date: new Date()
    };
    db.query(query, properties, function (err, node) {
        if (err) {
            console.log("error in db query: " + err);
            reply({message:"request error"});
        } else {
            reply({message:"successful request"});
        }
    }); 
};