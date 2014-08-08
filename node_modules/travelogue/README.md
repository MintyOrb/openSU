<a href="https://github.com/spumko"><img src="https://raw.github.com/spumko/spumko/master/images/from.png" align="right" /></a>
![travelogue Logo](https://raw.github.com/spumko/travelogue/master/images/travelogue.png)

[Passport.js](http://passportjs.org/) integration for [**hapi**](https://github.com/spumko/hapi)

[![Build Status](https://secure.travis-ci.org/spumko/travelogue.png)](http://travis-ci.org/spumko/travelogue)

Travelogue is a [Hapi plugin](https://github.com/spumko/hapi/blob/master/docs/Reference.md#server-plugins) that provides modular and unobtrusive authentication to Hapi through Passport. Travelogue supports almost every Passport strategy including Facebook OAuth, Google OpenID, and many others listed [here](https://github.com/jaredhanson/passport/wiki/Strategies).


## Install

    $ npm install travelogue yar passport


## Usage

Travelogue has been designed to integrate consistently with Passport APIs - allowing developers who have used Passport before to use Travelogue with very few modifications.  Thus, most Travelogue apps will follow the same general format outlined below:

```javascript
var config = {
    hostname: 'localhost',
    port: 8000,
    urls: {
        failureRedirect: '/login',
        successRedirect: '/'
    },
    facebook: {
        clientID: "...",
        clientSecret: "...",
        callbackURL: "http://localhost:8000/auth/facebook/callback"
    }
};

var plugins = {
    yar: {
        cookieOptions: {
            password: 'worldofwalmart', // cookie secret
            isSecure: false // required for non-https applications
        }
    },
    travelogue: config
};

var server = new Hapi.Server(config.hostname, config.port);
server.pack.require(plugins, function (err) { 

    if (err) {
        throw err;
    }
});

server.auth.strategy('passport', 'passport');

var Passport = server.plugins.travelogue.passport;

// Follow normal Passport rules to add Strategies
Passport.use(/* Strategy Goes Here */);
Passport.serializeUser(ser);
Passport.deserializeUser(deser);

// Add your routes
server.route(routeOne);
// ... 

server.start(function () {

    console.log('server started on port: ', server.info.port);
});
```

**Note:** Be careful with setting strategy `callbackURL`'s. If you are testing using `localhost:{port}`, make sure this matches the callbackURL exactly AND the designated callback URL in your third-party application settings.


#### Known Broken/Unsupported Strategies

Check the [GitHub Issues area](https://github.com/spumko/travelogue/issues) for exisiting issues and to report an issue.


### Route Handling

There are three common categories of third-party authentication route handling:

* External Authentication
* Internal Authentication
* Authorization

External Authentication allows the user to authenticate themselves via a third-party service like Facebook or Twitter.

Internal Authentication returns the credentials from External Authentication for verification on the server and ultimately "logs" the user on (saves their session for subsequent visits).

Authorization checks whether or not the user logged-on is allowed to access a specific route or resource.


#### External Authentication

For most third-party authentication schemes/strategies, External Authentication is done via a single route using the `Passport.authenticate(__strategy__)(request)` handler.

This handler typically will redirect the user to the third-party website, authenticate the user, and redirect to the `callbackURL` configured for that specific strategy (the Internal Authentication step).

```javascript
server.route({
    method: 'GET',
    path: '/auth/facebook',
    config: {
        handler: function (request, reply) {
            Passport.authenticate('facebook')(request, reply);
        }
    }
});
```

#### Internal Authentication

For all authentication schemes and strategies, the External Authentication information must be sent back to the server. Thus, one route handler must be specifically catered to the task of retrieving this information and processing it appropriately (using the `Passport.authenticate(strategy, options)(request, passthroughHandler)` format).

```javascript
server.route({
    method: 'GET',
    path: '/auth/facebook/callback',
    config: {
        handler: function (request, reply) {
            
            Passport.authenticate('facebook', {
                failureRedirect: config.urls.failureRedirect,
                successRedirect: config.urls.successRedirect,
                failureFlash: true
            })(request, reply, function (err) {

                if (err && err.isBoom) {
                    // This would be a good place to flash error message
                }
                return reply().redirect('/');
            });
        }
    }
});
```

#### Authorization

After verifying the identity of a user, the server will need to determine the permissions a user has for specific routes and resources.

In the typical case, once verified and logged-in, the user has full access to a new set of routes. Travelogue provides a shortcut to verify that a user is logged-on via the `config.auth` interface.

```javascript
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
```

However, it may be the case that there may be several levels of user access permissions. Just like with Passport, a custom function can be created similar to Passport's typical `ensureAuthenticated`.


#### Conflicts with Other Hapi Auth Schemes

It is possible to use multiple Hapi authentication schemes simultaneously within one application. To prevent conflicts, set the `config.auth` to `false` in any handler that should NOT use any auth schemes. An example is shown below.

```javascript
server.route({
    method: 'GET',
    path: '/',
    config: { 
        auth: false,
        handler: function (request, reply) {

            reply("Ohai");
        }
    },
});
```


## API Reference

While, Travelogue only requires the use of a few functions to configure and set up Passport authentication, it may be important to customize Travelogue's behavior outside the defaults. Therefore, Travelogue exposes several low-level methods. This section contains documentation for all methods and variables (__**but may be incomplete for the time being**__).

### Settings

Some settings must be passed into the Hapi plugins architecture.

- `yar` - the options object passed to yar
    - `cookieOptions`
        - `password` - (Required) secret key used to hash cookie
        - `isSecure` - enables TLS/SSL cookies. Defaults to **true**. Disable for normal http.
- `travelogue` - the options object passed to travelogue
    - `urls` - Urls used by Travelogue/Passport
        - `failureRedirect` - redirect to this relative URL on failed logins. Defaults to **'/login'**.
        - `successRedirect` - redirect to this relative URL on successful logins. Defaults to **'/'**.
    - `excludePaths` - array of string paths that will not employ travelogue authorization or authentication; these paths will be excluded from Travelogue.


Returns null.

### API

**Travelogue.passport**

Returns an alternative reference to the passport module. Can also be accessed from `server.plugins.travelogue.passport`.

**Travelogue.middleware**

Provides direct access to the passport middlewares specifically created for Hapi.

Returns an object with the following interface:

- `authenticate` - authentication related functions
- `initialize` - initialization related functions

Those functions can be modified to add custom behavior with respect to Passport. Modify at your own risk.

### Request-level

**Request.session._isAuthenticated()**

Returns true if the request is authenticated; false, otherwise.

**Request.session._logIn(user, options, next)**

Provides a direct interface to setting or modifying the user session data.

- `user` - (Required) an object that contains user session data
- `options` - the options object (currently unused)
- `next` - (Required) callback function to execute on completion or failure

Returns null. 

**Request.session._logOut()**

Permanently deletes the user session data ( thus unauthenticating the user and clearing out cookies).

Returns null.
