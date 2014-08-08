var Hapi = require('hapi');
var GoogleStrategy = require('passport-google').Strategy;

try {
    var config = require("./config.json");
}
catch (e) {
    var config = {
        hostname: 'localhost',
        port: 8000,
        urls: {
            failureRedirect: '/login',
            successRedirect: '/'
        },
        google: {
            realm: "http://localhost:8000/",
            returnURL: "http://localhost:8000/auth/google/return"
        }
    };
}

var plugins = {
    yar: {
        cookieOptions: {
            password: 'worldofwalmart',
            isSecure: false
        }
    },
    travelogue: config // use '../../' instead of travelogue if testing this repo locally
};

var server = new Hapi.Server(config.hostname, config.port);
server.pack.require(plugins, function (err) { 

    if (err) {
        throw err;
    }
});

server.auth.strategy('passport', 'passport');

var Passport = server.plugins.travelogue.passport;
Passport.use(new GoogleStrategy(config.google, function (identifier, profile, done) {

    // Find or create user here...
    return done(null, profile);
}));
Passport.serializeUser(function(user, done) {

    done(null, user);
});
Passport.deserializeUser(function(obj, done) {

    done(null, obj);
});

if (process.env.DEBUG) {
    server.on('internalError', function (event) {

        // Send to console
        console.log(event)
    });
}

// routes
server.route({
    method: 'GET',
    path: '/',
    config: { auth: 'passport' }, // replaces ensureAuthenticated
    handler: function (request, reply) {

        // If logged in already, redirect to /home
        // else to /login
        reply().redirect('/home');
    }
});


server.route({
    method: 'GET',
    path: '/login',
    config: {
        auth: false, // use this if your app uses other hapi auth schemes, otherwise optional
        handler: function (request, reply) {

            var html = '<a href="/auth/google">Login with Google</a>';
            if (request.session) {
                html += "<br/><br/><pre><span style='background-color: #eee'>session: " + JSON.stringify(request.session, null, 2) + "</span></pre>";
            }
            reply(html);
        }
    }
});


server.route({
    method: 'GET',
    path: '/home',
    config: { auth: 'passport' },
    handler: function (request, reply) {

        // If logged in already, redirect to /home
        // else to /login
        reply("ACCESS GRANTED");
    }
});


server.route({
    method: 'GET',
    path: '/auth/google',
    config: {
        auth: false,
        handler: function (request, reply) {

            Passport.authenticate('google')(request, reply);
        }
    }
});


server.route({
    method: 'GET',
    path: '/auth/google/return',
    config: {
        auth: false,
        handler: function (request, reply) {

            Passport.authenticate('google', {
                failureRedirect: config.urls.failureRedirect,
                successRedirect: config.urls.successRedirect,
                failureFlash: true
            })(request, reply, function (err) {

                if (err && err.isBoom) {
                    request.session.error = err;
                }
                reply().redirect('/');
            });
        }
    }
});


server.route({
    method: 'GET',
    path: '/clear',
    config: {
        auth: false,
        handler: function (request, reply) {

            request.session.reset();
            reply().redirect('/session');
        }
    }
});


server.route({
    method: 'GET',
    path: '/logout',
    config: {
        auth: false,
        handler: function (request, reply) {

            request.session._logout();
            reply().redirect('/');
        }
    }
});


server.route({
    method: 'GET',
    path: '/session',
    config: {
        auth: false,
        handler: function (request, reply) {

            reply("<pre>" + JSON.stringify(request.session, null, 2) + "</pre><br/><br/><a href='/login'>Login</a>");
        }
    }
});


server.start(function () {

    console.log('server started on port: ', server.info.port);
});
