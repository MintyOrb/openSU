To run this example you have to set up a app on twitter to get a consumerKey, consumerSecret and a callback twitter can redirect to on authorization complete.

To setup an app go to [Twitter developer pages ](https://dev.twitter.com/apps) and click the "Create new application" button. After the app has been created go to the settings tab and enter http://127.0.0.1:8000/auth/twitter/callback in the Callback URL field.  You must allso remember to tick "Allow this application ..." checkbox.

On the OAuth tool tab you should copy the consumer key and consumer secret and paste it into the ```config.twitter.consumerKey``` and ```config.twitter.consumerSecret``` in the index.js file. 

Now you can start the server with: 
```bash
node index.js
```
and point your browser to 127.0.0.1:8000/ .After logging in with your twitter credentials you should see "ACCESS GRANTED" in your browser.