/*global console, angular, setTimeout, alert*/
'use strict';

angular.module('universalLibrary').
    
controller('LoginModalInstanceCtrl' , function ($scope, $modalInstance, LoginService, authService, $http, $cookieStore) {
    console.log("instance ctrl here");
    $scope.form = {};
    $scope.display = {
        validEmail: true,
        validPass: true,
        returningUser: true,
        requestCode: false
    };
    $scope.user = {
        email : "",
        password : "",
        checkPassword: "",
        code: ""
    };

    // for alpha code request
    $scope.request = {
        email:"",
        reason:""
    };

    $scope.$on('$routeChangeStart', function(event, current, previous) {
        console.log("closing modal");
        LoginService.modalIsOpen = false;
        // only close if route change is not coming from loggedin resolve i.e. user access is denied
        if(previous.$$route === undefined || previous.$$route.resolve === undefined || Object.keys(previous.$$route.resolve)[0] !=='loggedin'){
            $modalInstance.close();
        }
    });

    $scope.checkEmail = function(){
        if($scope.form.loginForm.email.$invalid || $scope.user.email.length === 0){
            $scope.display.validEmail = false;
        } else {
            $scope.display.validEmail = true;
        }
    };
    $scope.checkPass = function() {
        if($scope.user.password !== $scope.user.checkPassword){
            $scope.display.validPass = false;
        } else {
            $scope.display.validPass = true;
        }
    };

    $scope.create = function () {
        if($scope.display.validEmail && $scope.display.validPass){
            $http.post('/user', $scope.user).
            then(function(response){
                console.log(response);
                //if successfull, log user in.
                if(response.data.successfulCreation === true){
                    console.log("successful creation, trying to login: ");
                    $scope.login($scope.user.email, $scope.user.password);
                } else {
                    $scope.message = response.data.message;
                }
                console.log(response);
                
            });
        }
    };

    $scope.requestCode = function() {
        $http.post('/requestCode', {email:$scope.request.email,reason:$scope.request.reason}).
        success(function(data){
            $scope.message = data.message;
        });
    };

    $scope.login = function (email, password) {
        
        if($scope.display.validEmail){
            $http.post("/login", { 'username': email, 'password': password }).
            then(function(response) {
                if(response.data.loginSuccessful === true){
                    console.log("success here");
                    $cookieStore.put('loggedIn',true);
                    LoginService.loggedIn = true;
                    LoginService.modalIsOpen = false;
                    authService.loginConfirmed();
                    $modalInstance.close();
                } else {
                    $scope.message = response.data.message;
                }
                console.log(response);
                
            });
        }
    };
    
    $scope.cancel = function () {
        $scope.user = {
            email : "",
            password : "",
            checkPassword: ""
        };
        authService.loginCancelled();
        $modalInstance.dismiss('cancel');
        LoginService.modalIsOpen = false;
    };

    //when modal closes make sure to note it in LoginService
    $modalInstance.result.then(function () {
        console.log('Modal success at:' + new Date());
        authService.loginConfirmed();
        console.log('Login Confirmed: ' + new Date());
        LoginService.modalIsOpen = false;
    }, function (reason) {
        console.log('Modal dismissed at: ' + new Date());
        console.log('Reason Closed: ' + reason);
        authService.loginCancelled();
        LoginService.modalIsOpen = false;
    });

}).

factory('LoginService', function ($location, $modal, $http, $cookieStore) {
    
    return {

        modalIsOpen: false,

        loggedIn: false,

        logout: function(){
            this.loggedIn = false;
            $http.post('/logout')
            .success(function(){
                console.log("success: ");
                $location.path('/home');
                $cookieStore.put('loggedIn',false);
            });
        },

        open: function () {
            console.log(this.modalIsOpen);
            if(!this.modalIsOpen){

                this.modalIsOpen = true;

                var modalInstance = $modal.open({
                    templateUrl: 'app/loginAndSessions/LoginModal.html',
                    controller: 'LoginModalInstanceCtrl',
                    windowClass: "",
                });
            }
        }
    };
});