/*global console, angular, setTimeout, window, FileReader, $ */
'use strict';

angular.module('universalLibrary').

controller('addingContentCtrl', ['$location', '$scope', 'contentTerms', 'appLanguage', '$http', function ($location, $scope, contentTerms, appLanguage, $http) {
    
    $scope.contentTerms = contentTerms;
    contentTerms.matchAll = false;
    contentTerms.emptyAll(); 

    $scope.tab = {
        description: false,
        value: false,
        terms: true
    };

    $scope.imageDisplaySettings = {
        fileSelected : false,
        imageURLPresent : false,
        dataUrl : []
    };
    $scope.displaySettings = {
        fileName: "",
        optionSelected : false,
        disableFileSelection : false,
        uploadNonImage : false,
        s3URL: false
    };

    $scope.contentObject = {
        language: appLanguage.languageCode,
        // language specific
        meta: {
            // source: {
            //     url: "",
            //     text: ""
            // },
            // takeAway: "",
            value: "",
            description: "",
            title: ""
        },
        // for all
        savedAs: "",
        fileSystemID: "",
        displayType: "",
        embedSrc: "",
        webURL: "",
        assignedTerms: $scope.contentTerms.selected
    };

    $scope.submitNewContent = function(){
        // TODO: validate that necessary fields are filled out before POSTing
        // console.log($scope.contentTerms.selected);
        // console.log(contentTerms.selected);
        console.log($scope.contentObject);
        $scope.contentObject.assignedTerms = $scope.contentTerms.selected; // for some reason the content object only recieves the selected terms if this is present. It seems to recieve them even before this assignment is made though.
        console.log($scope.contentObject);
        $http.post('/newContent', $scope.contentObject).
        success(function(response){
            console.log(response);
            $location.path('/content/' + response.UUID);
            $scope.reset();
        });
    };

    $scope.reset = function(){
        console.log("resetting: " );
        $scope.displaySettings = {
            fileName: "",
            optionSelected : false,
            disableFileSelection : false,
            uploadNonImage : false,
            s3URL : false
        };
        $scope.imageDisplaySettings = {
            fileSelected : false,
            imageURLPresent : false,
            dataUrl : {}
        };
        $scope.contentObject.savedAs = "";
        $scope.contentObject.fileSystemID = "";
        $scope.contentObject.displayType = "";
        $scope.contentObject.embedSrc = "";
        $scope.contentObject.webURL = "";
        contentTerms.selected = [];
        contentTerms.discarded = [];    
        contentTerms.related = [];      
        contentTerms.search = [];       
    };
    
}]).













controller("fileSelectionCtrl", function ($timeout, $scope, $http, $upload, appLanguage){


    $scope.onFileSelect = function(file) {

        //only allow image files
        if (file[0].type.indexOf('image') === -1) {
            $scope.displaySettings.uploadNonImage = true;
        } else {

            $scope.displaySettings.uploadNonImage = false; //hide error message if shown

            //get data for displaying image preview
            if (window.FileReader) {
                var fileReader = new FileReader();
                fileReader.readAsDataURL(file[0]);
                fileReader.onload = function(e) {
                    $timeout(function() {
                        $scope.imageDisplaySettings.dataUrl.image = e.target.result;
                    });
                };
            }    

            $scope.imageDisplaySettings.fileSelected = true;  //display image preview and selected file name
            $scope.displaySettings.optionSelected = true;     //display cancel button
            $scope.displaySettings.fileName = file[0].name;   //place file name in exposed input
            
            // wait until submit...?
            $upload.upload({
                url: '/newImage',
                file: file[0],
                data: {name: file[0].name, language: appLanguage.languageCode, type:file[0].type},
                progress: function(evt){
                //TODO show upload progress to user
                    console.log('percent: ' + parseInt(100.0 * evt.loaded / evt.total));
                }
            }).then(function(response, status, headers, config) {
                $scope.contentObject.savedAs = response.data.savedAs;
                $scope.contentObject.fileSystemID = response.data.id;
                $scope.contentObject.displayType = response.data.displayType;
                console.log("$scope.contentObject: " + JSON.stringify($scope.contentObject));
                console.log("it worked: " + JSON.stringify(response));
            }); 
        }
    };

    $scope.onURLChange = function () {
        
        $scope.displaySettings.uploadNonImage = false; //hide error message if inputting a URL

        if($scope.addContentForm.pasteURL.$valid && $scope.contentObject.webURL.length > 0){

            $scope.displaySettings.optionSelected = true;  //display cancel button
            $scope.displaySettings.disableFileSelection = true;

            // wait until submit...?
            $http.post('/addContentFromURL', {url: $scope.contentObject.webURL, language: appLanguage.languageCode}).
            success(function(response){

                if(response.displayType === "image"){
                    $scope.imageDisplaySettings.imageURLPresent = true; //display preivew of linked image
                }
                if(response.displayType === "webpage" || (response.displayType === "embed" && response.embedSrc.indexOf("youtube") > -1)){
                    $scope.imageDisplaySettings.s3URL = true;
                }
                $scope.contentObject.savedAs = response.savedAs;
                $scope.contentObject.embedSrc = response.embedSrc;
                $scope.contentObject.fileSystemID = response.id;
                $scope.contentObject.displayType = response.displayType;

            });
        }
    };

}).












controller('newTermModalInstanceCtrl' , function ($scope, $modalInstance, data, contentTerms, $http) {

    $scope.newTermMeta = {};

    // $scope.newTermMeta.groups = filterFactory().groups;

    $scope.newTermMeta.name = data.termData.name;
    $scope.newTermMeta.mid = data.termData.mid; 
    $scope.newTermMeta.lang = data.termData.lang;
    
    $scope.$on('$routeChangeStart', function() {
        // TODO: fix error if modal closed properly
        // should be fixed in next angular ui update...?
        console.log("closing modal");
        $modalInstance.close();
    });

    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };

    $scope.addToSelectedFromFB = function(){
        //add to array to prevent visual delay
        console.log("lang from newtermmeta: " + $scope.newTermMeta.lang);
        data.selected.push({
            mid: $scope.newTermMeta.mid,
            name: $scope.newTermMeta.name,
            langAddedIn: $scope.newTermMeta.lang,
            definition: $scope.newTermMeta.definition
        });
        //add to database (if not already stored) and return UUID
        $modalInstance.close();
        console.log("newtermmeta: " );
        console.log($scope.newTermMeta);
        $http.post('/term', $scope.newTermMeta)
        .success(function(returned){
            //add UUID to item in selected
            for(var index = 0; index < contentTerms.selected.length; index++){
                if(contentTerms.selected[index].mid === $scope.newTermMeta.mid){
                    contentTerms.selected[index].UUID = returned.UUID;
                }
            }
        });
    };  

    //modal close
    $modalInstance.result.then(function () {
        console.log('Modal success at:' + new Date());
    }, function (reason) {
        console.log('Modal dismissed at: ' + new Date());
        console.log('Reason Closed: ' + reason);
    });
}).

directive('suggest', function() {
    return {
        restrict: 'E',
        template: "<input style='background: url(img/fbIcon.png); background-position: 140px 6px; background-repeat: no-repeat;' ng-model='inputModel' type='text'>",
        replace:true,
        scope:{
            onSelect:'&',
            inputModel:'='
        },
        link: function(scope, element, attrs) {
            attrs.$observe('lang', function(value) {
                $(element).suggest({
                    lang: value,
                    key: "AIzaSyCrHUlKm60rk271WLK58cZJxEnzqNwVCw4"
                })
                .unbind("fb-select")
                .bind("fb-select", function(e, info) { 
                    console.log(info);
                    scope.$apply(
                        scope.onSelect({data:info})
                    );
                });
            });
        }
    };
});