/*global console, angular, setTimeout, window, FileReader, $ */
'use strict';

angular.module('universalLibrary').

controller("exploreCtrl", function ($scope, $http, appLanguage, contentTerms, $cookieStore, $timeout) {

    $scope.noMoreContent = false;
    $scope.contentTerms = contentTerms;
    $scope.returnedContent = [];
    $scope.autoStartTutorial = true;

    $scope.$watchCollection("contentTerms.selected", function(){
        getRelatedContent();
    });

    // re-fetch content on language switch
    $scope.$watch("displayLanguage.languageCode", function(){
        getRelatedContent();
    });

    var getRelatedContent = function(){
        $scope.noMoreContent = false;
        $http.post('/explore', { 
            includedTerms: $scope.contentTerms.selected,
            excludedTerms: $scope.contentTerms.discarded, 
            language: appLanguage.languageCode,
            skip: 0 
        }).
        success(function(data){
            if(data.length === 0){
                $scope.noMoreContent = true;
            }
            $scope.returnedContent = data;
        });
    };

    // this is essential the same as the realted content function. Combine to be more DRY?
    $scope.loadMoreContent = function(){
        $http.post('/explore', { 
            includedTerms: $scope.contentTerms.selected,
            excludedTerms: $scope.contentTerms.discarded, 
            language: appLanguage.languageCode,
            skip: $scope.returnedContent.length,
            orderby: 'something' // use code? string literal? 
        }).
        success(function(data){
            console.log("success contnet: ");
            console.log(data);
            if(data.length === 0){
                $scope.noMoreContent = true;
            } else {
                for (var ii = 0; ii < data.length; ii++) {
                    $scope.returnedContent.push(data[ii]);
                } 
            }
        });
    };

    // don't run tutorial if logged in
    if($scope.Login.loggedIn){
        $cookieStore.put("showTutorial", false);
    }
    if($cookieStore.get('showTutorial') !== false){
        $timeout(function(){
            $scope.StartIntro();
        }, 
        1000);
    }
    // do not auto run tutorial if it has been run before
    $scope.onExit = function(){
        $cookieStore.put("showTutorial", false);
    };
    
    $scope.IntroOptions = {
        steps:[
            {
                element: '#step1',
                intro: "Welcome to Oaddo!<br><br>This tutorial will show you how to find interesting content.",
                position: 'top',
            },
            {
                element: '#step2',
                intro: "This is the search term container. The terms in this container determine what content is returned below.",
                position: 'top'
            },
            {
                element: '#step3',
                intro: 'You can manually add terms to the search container by typing them here. Or...',
                position: 'bottom'
            },
            {
                element: '#step4',
                intro: "...you can select terms from this container, which is automatically filled with terms related to those in the search container. <br><br>To add a term, just click on it or drag it into the search container.",
                position: 'bottom'
            },
            {
                element: '#step5',
                intro: 'You can filter the related terms by selecting a term group. Only terms in the selected group will be returned.',
                position: 'bottom'
            },
            {
                element: '#step6',
                intro: 'This is the container for discarded terms. Terms in this container will not show up in the related terms container- you can use it to free up space for terms you might be more interested in.',
                position: 'top'
            },
            {
                element: '#step7',
                intro: 'Content related to terms in the search container will appear here. Click on the content to go to its individual page.<br><br>Thats it!',
                position: 'top'
            }
        ],
        showStepNumbers: false,
        autoStart: $scope.autoStartTutorial,
        exitOnOverlayClick: true,
        exitOnEsc: true,
        showBullets: true,
        nextLabel: '<strong>next</strong>',
        prevLabel: 'Previous',
        skipLabel: 'Exit',
        doneLabel: 'Start exploring!',
        scrollToElement: false
   };
}).

filter('language', function() {
    // TODO: find a way to include the english name if the term is not found in the chosen language
    // this will probably require manipulating the db query
    return function(input, currentCode) {
       
        if(input.language !== currentCode){
            input.name = "";
        }

        return input.name;
    };
}).

service('viewContent', [function () {
    this.selected = {};
}]).


controller('contentPageCtrl', [
    '$sce', 
    '$http',
    '$routeParams', 
    '$scope', 
    "viewContent", 
    "appLanguage", 
    '$window', 
    // 'filterFactory',
    function ($sce, $http, $routeParams, $scope, viewContent, appLanguage, $window) {

// TODO: refactor. A lot of this code is the same as in the termSelectionCtrl (in shared)

    $scope.panel = {
        visible : false,
        size : '50%',
        section : 'about',
        editTerms : false
    };

    $scope.content = {
        changesNotMade: true, // disable/enable save changes
        editTerms : false,
        UUID : $routeParams.id,
        originalTerms: [],
        terms: [],
        relatedTerms: [],
        relatedContent:[],
        about:{
            notRequested:true,
            description:"",
            value:"",
            title:""
        }
    };

    // console.log($window.outerWidth); use for changeing css for mobile

    // needed for term suggestions when editing content terms
    // $scope.filter = filterFactory();
    // $scope.filter.setAll(true);  // initialize filter values to true (include all types)

    // $scope.$watch("filter.groups", function(newValue, oldValue){
    //     if (newValue !== oldValue && $scope.content.editTerms) {
    //         $scope.getPossibleTerms();
    //     }
    // }, true); // true as second parameter sets up deep watch

    // $scope.$watchCollection('content.terms', function(){
    //     if($scope.content.editTerms){
    //         $scope.getPossibleTerms();
    //     }
    // });

    // TODO: handle error - if content with UUID not found, display error - just do 404?
    $http.get('/content/' + $scope.content.UUID, {params: {language: appLanguage.languageCode}})
    .success(function(data){
        viewContent.selected = data[0];  
        $scope.content.display = viewContent.selected;
        $scope.content.display.embedSrc = $sce.trustAsResourceUrl($scope.content.display.embedSrc);
        $scope.content.display.webURL = $sce.trustAsResourceUrl($scope.content.display.webURL);

    });

    $scope.getContentTerms = function(){
        if($scope.content.terms.length === 0){
            $http.get('/content/' + $scope.content.UUID + '/terms', {params: {language: appLanguage.languageCode}})
            .success(function(returned){
                for (var ii = 0; ii < returned.length; ii++) {
                    $scope.content.terms.push(returned[ii]);
                    $scope.content.originalTerms.push(returned[ii]);
                }
            });
        }
    };
    $scope.getAbout = function(){
        if($scope.content.about.notRequested){
            $http.get('/contentAbout', {params: {uuid: $scope.content.UUID, language: appLanguage.languageCode}})
            .success(function(returned){
                    $scope.content.about.description = returned.description;
                    $scope.content.about.value = returned.value;
                    $scope.content.about.title = returned.title;
            });
        }
    };

    $scope.remove = function (index){
        $scope.content.changesNotMade = false;
        $scope.content.terms.splice(index,1);
    };

    $scope.cancelEdit = function(){
        $scope.content.changesNotMade = true;
        $scope.panel.editTerms = false;
        $scope.content.terms=[];
        for (var ii = 0; ii < $scope.content.originalTerms.length; ii++) {
            $scope.content.terms.push($scope.content.originalTerms[ii]);
        }
    };

    $scope.saveNewTerms = function(){
        $http.put('/content/' + $scope.content.UUID + '/terms', {newTerms:$scope.content.terms})
        .success(function(){
            console.log("success in adding term: ");
            $scope.content.changesNotMade = true;
            $scope.panel.editTerms = false;
            $scope.content.originalTerms=[];
            for (var ii = 0; ii < $scope.content.terms.length; ii++) {
                $scope.content.originalTerms.push($scope.content.terms[ii]);
            }
        });
    };

    // $scope.getPossibleTerms = function(){
    //     $http.post('/relatedTerms', 
    //         {
    //             matchAll: false, 
    //             uuid: $scope.content.UUID, 
    //             language: appLanguage.languageCode,
    //             keyTerms: $scope.content.terms,
    //             groups: $scope.filter.groups
    //         })
    //     .success(function(data){
    //         $scope.content.relatedTerms = data.results;
    //     });
    // };
    // $scope.getRelatedContent = function(){
    //     $http.post('/explore', { 
    //         includedTerms: $scope.contentTerms.selected,
    //         excludedTerms: $scope.contentTerms.discarded, 
    //         language: appLanguage.languageCode }).
    //     success(function(data){
    //         $scope.returnedContent = data; 
    //     });
    // };



}]).






directive('zui', [function () {
	return {
		restrict: 'E',
		scope: { url: "@"},
        // NOTE: changed overlay style of .zui div to visible and added 'left':'0', 'right':'0' to viewport div in prototype in zui53.js
        // TODO: find better solution for centering displayed content - this method allows the user to zoom on the magin 'wings' used for centering
		template: '<div id="zui" ><div id="viewport" ><img src="{{imageURL}}" style="display:block; margin-left: auto; margin-right: auto; max-height: 400px;"></div></div>',
		link: function (scope, element, attrs) {
            scope.imageURL = scope.url;
			var zui = new ZUI53.Viewport( document.getElementById('zui') );
            zui.addSurface( new ZUI53.Surfaces.CSS( document.getElementById('viewport') ) );
            
            var pan_tool = new ZUI53.Tools.Pan(zui);
            zui.toolset.add( pan_tool );
            pan_tool.attach();
		}
	};
}]).



// TODO: trim unneeded functionality
// taken from https://github.com/dpiccone/ng-pageslide and modifiedc
directive('pageslide', [
     function (){
        var defaults = {};
        /* Return directive definition object */

        return {
            restrict: "EA",
            replace: false,
            transclude: false,
            scope: true,
            link: function ($scope, el, attrs) {
                /* Inspect */
                //console.log($scope);
                //console.log(el);
                //console.log(attrs);
                
                /* parameters */
                var param = {};
                param.side = attrs.pageslide || 'right';
                param.speed = attrs.psSpeed || '0.5';
                param.size = attrs.size || '300px';

                /* DOM manipulation */
                var content = (attrs.href) ? document.getElementById(attrs.href.substr(1)) : document.getElementById(attrs.psTarget.substr(1));
                var slider = document.createElement('div');
                slider.id = "ng-pageslide";

                /* Style setup */
                slider.style.transitionDuration = param.speed + 's';
                slider.style.webkitTransitionDuration = param.speed + 's';
                slider.style.zIndex = 499;
                slider.style.position = 'fixed';
                slider.style.width = 0;
                slider.style.height = 0;
                slider.style.transitionProperty = 'width, height';
                
                switch (param.side){
                            case 'right':
                                slider.style.height = attrs.customHeight || '100%'; 
                                slider.style.top = attrs.customTop ||  '0px';
                                slider.style.bottom = attrs.customBottom ||  '0px';
                                slider.style.right = attrs.customRight ||  '0px';
                                break;
                            case 'left':
                                slider.style.height = attrs.customHeight || '100%';   
                                slider.style.top = attrs.customTop || '0px';
                                slider.style.bottom = attrs.customBottom || '0px';
                                slider.style.left = attrs.customLeft || '0px';
                                break;
                            case 'top':
                                slider.style.width = attrs.customWidth || '100%';   
                                slider.style.left = attrs.customLeft || '0px';
                                slider.style.top = attrs.customTop || '0px';
                                slider.style.right = attrs.customright || '0px';
                                break;
                            case 'bottom':
                                slider.style.width = attrs.customWidth || '100%'; 
                                slider.style.bottom = attrs.customBottom || '0px';
                                slider.style.left = attrs.customLeft || '0px';
                                slider.style.right = attrs.customRight || '0px';
                                break;
                        }


                /* Append */
                document.body.appendChild(slider);
                slider.appendChild(content);

                /* Closed */
                function psClose(slider,param){
                    if (slider.style.width !== 0 && slider.style.width !== 0){
                        content.style.display = 'none';
                        switch (param.side){
                            case 'right':
                                slider.style.width = '0px'; 
                                break;
                            case 'left':
                                slider.style.width = '0px';
                                break;
                            case 'top':
                                slider.style.height = '0px'; 
                                break;
                            case 'bottom':
                                slider.style.height = '0px'; 
                                break;
                        }
                    }
                }

                /* Open */
                function psOpen(slider,param){
                    if (slider.style.width !== 0 && slider.style.width !== 0){
                        switch (param.side){
                            case 'right':
                                slider.style.width = param.size; 
                                break;
                            case 'left':
                                slider.style.width = param.size; 
                                break;
                            case 'top':
                                slider.style.height = param.size; 
                                break;
                            case 'bottom':
                                slider.style.height = param.size; 
                                break;
                        }
                        setTimeout(function(){
                            content.style.display = 'block';
                        },(param.speed * 1000));

                    }
                }
                
                /*
                 * Watchers
                 * */

                $scope.$watch(attrs.psOpen, function (value){
                    if (!!value) {
                        // Open
                        psOpen(slider,param);
                    } else {
                        // Close
                        psClose(slider,param);
                    }
                });

                $scope.$on("$locationChangeStart", function(){
                    if(attrs.autoClose){
                        slider.remove();
                        psClose(slider, param);
                    }
                });


                /*
                * Events
                * */
                var close_handler = (attrs.href) ? document.getElementById(attrs.href.substr(1) + '-close') : null;
                if (el[0].addEventListener) {
                    el[0].addEventListener('click',function(e){
                        e.preventDefault();
                        psOpen(slider,param);                    
                    });

                    if (close_handler){
                        close_handler.addEventListener('click', function(e){
                            e.preventDefault();
                            psClose(slider,param);
                        });
                    }
                } else {
                    // IE8 Fallback code
                    el[0].attachEvent('onclick',function(e){
                        e.returnValue = false;
                        psOpen(slider,param);                    
                    });

                    if (close_handler){
                        close_handler.attachEvent('onclick', function(e){
                            e.returnValue = false;
                            psClose(slider,param);
                        });
                    }

                }
            }
        };

     }]);


