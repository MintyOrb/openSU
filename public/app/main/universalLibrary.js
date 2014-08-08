/*global console, angular, setTimeout, alert, window */
'use strict';

var universalLibrary = angular.module('universalLibrary', 
    [
        'ngRoute', 
        'ui.bootstrap',
        'ngSanitize',
        'ngResource',
        'ngCookies',
        'ngAnimate',
        'angularFileUpload',
        'http-auth-interceptor',
        'textAngular',
        'chieffancypants.loadingBar',
        'ngAnimate-animate.css',
        'ngDragDrop',
        'angular-intro',
        'angulartics',
        'angulartics.google.analytics'
    ]).

config(function($routeProvider, $locationProvider, $httpProvider) {

    //function for checking login status before a route change
    // NOTE: this just checks a cookie value and is VERY EASILY faked. However, if fake no malicious behavior should be able to occur.
    var checkLoggedin = function ($q, $http, $location, $window, LoginService, $cookieStore) {
        
        console.log("check logged in function here.");

        // Initialize a new promise 
        var deferred = $q.defer();

        console.log("loggedin: ");
        console.log($cookieStore.get('loggedIn'));
        if($cookieStore.get("loggedIn")){
            deferred.resolve();
        } else {
            deferred.reject();
            $window.history.back();
            console.log("before to: " + $location.path());
            LoginService.open();
        }
        return deferred.promise;
    };


    $routeProvider
    .when('/home', { title: "home", templateUrl: 'app/main/home.html'})
    .when('/explore', {title: "explore", templateUrl: 'app/exploreContent/explore.html'})
    .when('/addContent', {title: "new content", resolve: {loggedin: checkLoggedin}, templateUrl: 'app/addingContent/newContent.html'})
    .when('/content/:id', {title: "content", templateUrl: 'app/exploreContent/contentPage.html', controller:'contentPageCtrl'})
    .otherwise({redirectTo: '/home'});
    $locationProvider.html5Mode(true);
}).

run(function ($rootScope, LoginService, $cookieStore, appLanguage) {

    // change site title based on route
    $rootScope.$on('$routeChangeSuccess', function (event, current, previous) {
        if(current.$$route){
            $rootScope.title = current.$$route.title;
        }
    });

    //respond to 401s by opening login modal
    $rootScope.$on('event:auth-loginRequired', function() {
        console.log("auth event fired");
        LoginService.open();
    });

    if($cookieStore.get('loggedIn') !== undefined){
        LoginService.loggedIn = $cookieStore.get('loggedIn');
    }

    //set language for session based on saved value or value from window
    if (appLanguage.get() === undefined){
        var lang = window.navigator.userLanguage || window.navigator.language;
        lang = lang.substr(0,2); // get two letter language code
        appLanguage.setByCode(lang);
    } else {
        appLanguage.setLanguage($cookieStore.get('languagePreference'));
    }
}).

service('appLanguage', ['$cookieStore',function ($cookieStore) {
    
    this.languageCode = "";
    this.name = "";
    this.nativeName = "";

    this.setByCode = function(code){
        var languageObj = this.findMatchingLanguage(code);
        languageObj.languageCode = code;
        this.setLanguage(languageObj);
    };

    this.setLanguage = function(langObj){
        this.languageCode = langObj.languageCode;
        this.name = langObj.name;
        this.nativeName = langObj.nativeName;
        $cookieStore.put('languagePreference', langObj);
    };

    this.get = function(){
        return $cookieStore.get('languagePreference');
    };

    this.dropdownSelect = function(key, langObj){
        var lang = langObj;
        lang.languageCode = key;
        this.setLanguage(lang);
    };

    this.findMatchingLanguage = function(code){
        for(var lang in this.languages){
            if(lang === code){
                return {
                    nativeName: this.languages[lang].nativeName,
                    name: this.languages[lang].name
                };
            }
        }
        // default to english if code not found
        return {
                    nativeName: 'English',
                    name: 'English'
                };
    };

    this.languages = {
        "ar":{
            "name":"Arabic",
            "nativeName":"العربية"
        },
        "bg":{
            "name":"Bulgarian",
            "nativeName":"български език"
        },
        "ca":{
            "name":"Catalan; Valencian",
            "nativeName":"Català"
        },
        "cs":{
            "name":"Czech",
            "nativeName":"česky, čeština"
        },
        "da":{
            "name":"Danish",
            "nativeName":"dansk"
        },
        "de":{
            "name":"German",
            "nativeName":"Deutsch"
        },
        "el":{
            "name":"Greek, Modern",
            "nativeName":"Ελληνικά"
        },
        "en":{
            "name":"English",
            "nativeName":"English"
        },
        "eo":{
            "name":"Esperanto",
            "nativeName":"Esperanto"
        },
        "es":{
            "name":"Spanish; Castilian",
            "nativeName":"español, castellano"
        },
        "es-419":{
            "name":"Latin America Spanish",
            "nativeName":"espanol de America Latina"
        },
        "et":{
            "name":"Estonian",
            "nativeName":"eesti, eesti keel"
        },
        "fa":{
            "name":"Persian",
            "nativeName":"فارسی"
        },
        "fi":{
            "name":"Finnish",
            "nativeName":"suomi, suomen kieli"
        },
        "fr":{
            "name":"French",
            "nativeName":"français, langue française"
        },
        "gd":{
            "name":"Scottish Gaelic; Gaelic",
            "nativeName":"Gàidhlig"
        },
        "he":{
            "name":"Hebrew (modern)",
            "nativeName":"עברית"
        },
        "hi":{
            "name":"Hindi",
            "nativeName":"हिन्दी, हिंदी"
        },
        "hr":{
            "name":"Croatian",
            "nativeName":"hrvatski"
        },
        "hu":{
            "name":"Hungarian",
            "nativeName":"Magyar"
        },
        "id":{
            "name":"Indonesian",
            "nativeName":"Bahasa Indonesia"
        },
        "it":{
            "name":"Italian",
            "nativeName":"Italiano"
        },
        "ja":{
            "name":"Japanese",
            "nativeName":"日本語 (にほんご／にっぽんご)"
        },
        "ko":{
            "name":"Korean",
            "nativeName":"한국어 (韓國語), 조선말 (朝鮮語)"
        },
        "lt":{
            "name":"Lithuanian",
            "nativeName":"lietuvių kalba"
        },
        "lv":{
            "name":"Latvian",
            "nativeName":"latviešu valoda"
        },
        "ms":{
            "name":"Malay",
            "nativeName":"bahasa Melayu, بهاس ملايو‎"
        },
        "nl":{
            "name":"Dutch",
            "nativeName":"Nederlands, Vlaams"
        },
        "no":{
            "name":"Norwegian",
            "nativeName":"Norsk"
        },
        "pl":{
            "name":"Polish",
            "nativeName":"polski"
        },
        "pt":{
            "name":"Portuguese",
            "nativeName":"Português"
        },
        "ro":{
            "name":"Romanian, Moldavian, Moldovan",
            "nativeName":"română"
        },
        "ru":{
            "name":"Russian",
            "nativeName":"русский язык"
        },
        "sk":{
            "name":"Slovak",
            "nativeName":"slovenčina"
        },
        "sl":{
            "name":"Slovene",
            "nativeName":"slovenščina"
        },
        "sr":{
            "name":"Serbian",
            "nativeName":"српски језик"
        },
        "sv":{
            "name":"Swedish",
            "nativeName":"svenska"
        },
        "th":{
            "name":"Thai",
            "nativeName":"ไทย"
        },
        "tr":{
            "name":"Turkish",
            "nativeName":"Türkçe"
        },
        "uk":{
            "name":"Ukrainian",
            "nativeName":"українська"
        },
        "vi":{
            "name":"Vietnamese",
            "nativeName":"Tiếng Việt"
        },
        "zh":{
            "name":"Chinese",
            "nativeName":"中文 (Zhōngwén), 汉语, 漢語"
        },
        "zh-hant":{
            "name":"traditional Chinese",
            "nativeName":"中文（繁體)"
        }
    };

}]).

controller('alphaAlertCtrl', ['$scope', '$cookieStore', function ($scope, $cookieStore) {
    $scope.options = {dontShowAgain: false};
    if($cookieStore.get('showAlphaAlert') === undefined){
         $scope.showAlphaAlert = true;
    } else {
        $scope.showAlphaAlert = $cookieStore.get('showAlphaAlert');   
    }
    

    $scope.close = function(){
        console.log("dont show agian: " + $scope.options.dontShowAgain);
        if($scope.options.dontShowAgain){
            console.log("saving as false: ");
            $cookieStore.put('showAlphaAlert', false);
        } else {
            console.log("saving as true: ");
            $cookieStore.put('showAlphaAlert', true);
        }
        $scope.showAlphaAlert = false;
    };
}]).
controller('appCtrl', ['$scope', 'appLanguage', 'LoginService', '$route',function ($scope, appLanguage, LoginService, $route) {

    $scope.displayLanguage = appLanguage;
    $scope.Login = LoginService; 
    $scope.getCurrentTemplate = function(){
        if($route.current) {
            return $route.current.loadedTemplateUrl;
        }
    };

}]);
