var Hapi = require('hapi');
var LocalStrategy = require('passport-local').Strategy;


var config = {
    hostname: 'localhost',
    port: 8000,
    urls: {
        failureRedirect: '/login'
    },
    excludePaths: ['/public/']
};
var plugins = {
    yar: {
        cookieOptions: {
            password: "worldofwalmart",
            isSecure: false
        }
    },
    travelogue: config // use '../../' instead of travelogue if testing this repo locally
}

var server = new Hapi.Server(config.hostname, config.port);
server.pack.require(plugins, function (err) {

    if (err) {
        throw err;
    }
});

server.auth.strategy('passport', 'passport');

var USERS = {
    "van": "walmart"
};

var Passport = server.plugins.travelogue.passport;
Passport.use(new LocalStrategy(function (username, password, done) {

    // Find or create user here...
    // In production, use password hashing like bcrypt
    if (USERS.hasOwnProperty(username) && USERS[username] == password) {
        return done(null, { username: username });
    }

    return done(null, false, { 'message': 'invalid credentials' });
}));
Passport.serializeUser(function (user, done) {

    done(null, user);
});
Passport.deserializeUser(function (obj, done) {

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

            if (request.session._isAuthenticated()) {
                reply().redirect('/home');
            } else {
                var form = '<form action="/login" method="post"> <div> <label>Username:</label> <input type="text" name="username"/> </div> <div> <label>Password:</label> <input type="password" name="password"/> </div> <div> <input type="submit" value="Log In"/> </div> </form>';
                reply(form);
            }
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
        reply("ACCESS GRANTED<br/><br/><a href='/logout'>Logout</a>");
    }
});


server.route({
    method: 'POST',
    path: '/login',
    config: {
        validate: {
            payload: {
                username: Hapi.types.String(),
                password: Hapi.types.String()
            }
        },
        auth: false,
        handler: function (request, reply) {

            Passport.authenticate('local', {
                successRedirect: config.urls.successRedirect,
                failureRedirect: config.urls.failureRedirect,
                failureFlash: true
            })(request, reply)
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
    path: '/session',
    config: {
        auth: false,
        handler: function (request, reply) {

            reply("<pre>" + JSON.stringify(request.session, null, 2) + "</pre><br/><br/><a href='/login'>Login</a>");
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
    path: '/public/{path}',
    handler: {
        directory: {
            path: './public'
        }
    }
});


server.start(function () {

    console.log('server started on port: ', server.info.port);
});
