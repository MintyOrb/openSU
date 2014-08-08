// Load modules

var Lab = require('lab');
var LocalStrategy = require('passport-local');
var Travelogue = require('../../');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Lab.expect;
var before = Lab.before;
var after = Lab.after;
var describe = Lab.experiment;
var it = Lab.test;


describe('#authenticate', function () {

    Travelogue.internals.setHapi(require('hapi'));

    it('should accept function in place of options', function (done) {

        var authenticate = Travelogue.internals.authenticate(Travelogue.internals.defaults)(require('passport'), 'local', function (err) { });
        expect(authenticate).to.exist;
        done();
    });

    describe('#allFailed', function () {

        var failureOne = { challenge: 1, status: 'test' };
        var failureTwo = { challenge: 2, status: 'test' };
        var failures = [failureOne, failureTwo];

        var strFailureOne = { challenge: 'fail1', status: 'test' };
        var strFailureTwo = { challenge: 'fail2', status: 'test' };
        var strFailures = [strFailureOne, strFailureTwo];

        it('should return callback if defined and handle case where one failure', function (done) {

            var failure = { challenge: 1, status: 'test' };
            var allFailed = Travelogue.internals.allFailedFactory({}, function () { }, [failure], {}, function (err, success, challenge, status) {

                expect(err).to.not.exist;
                expect(success).to.equal(false);
                expect(challenge).to.equal(failure.challenge);
                expect(status).to.equal(failure.status);
                done();
            });
            allFailed();
        });

        it('should return callback if defined and handle case where failures', function (done) {


            var allFailed = Travelogue.internals.allFailedFactory({}, function () { }, failures, {}, function (err, success, challenges, statuses) {

                expect(err).to.not.exist;
                expect(success).to.equal(false);

                failures.forEach(function (el, index) {

                    expect(el.challenge).to.equal(challenges[index]);
                    expect(el.status).to.equal(statuses[index]);
                });
                done();
            });
            allFailed();
        });

        it('should set status to challenge if given number, no callback given', function (done) {

            var reqMock = {};

            var allFailed = Travelogue.internals.allFailedFactory(reqMock, function () { done(); }, failures, {});
            allFailed();
        });

        it('should return Unauthorized challenge if given string, no callback given', function (done) {

            var reqMock = {};
            var reply = function (response) {

                var expectedVal = strFailures.map(function (d) { return d.challenge; }).join(', ');
                expect(response.output.headers['WWW-Authenticate']).to.equal(expectedVal);
                done();
            };

            var allFailed = Travelogue.internals.allFailedFactory(reqMock, reply, strFailures, {});
            allFailed();
        });
    });

    describe('#transformAuthInfoCallback', function () {

        var error = true;
        var reqMock = {};

        it('should return err on err', function (done) {

            var cbMock = function (err) {

                expect(err).to.exist;
                expect(err).to.equal(error);
                done();
            };
            var completeMock = function () {

                done();
            };
            var transformAuthInfoCallback = Travelogue.internals.transformAuthInfoCallback(reqMock, cbMock, completeMock);
            transformAuthInfoCallback(error);
        });
    });

    describe('#delegateErrorFactory', function () {

        var error = true;

        it('should return err on err', function (done) {

            var cbMock = function (err) {

                expect(err).to.exist;
                expect(err.message.split(':').pop().slice(1)).to.equal(error.toString());
                done();
            };
            var delegateError = Travelogue.internals.delegateErrorFactory(cbMock);
            delegateError(error);
        });
    });

    describe('#delegateRedirectFactory', function () {

        var expectedUrl = '/test'

        it('should return a redirect given a url', function (done) {

            var replyMock = function () {
                return {
                    redirect: function (url) {
                        expect(url).to.exist;
                        expect(url).to.equal(expectedUrl);
                        done();
                    }
                }
            }

            var delegateRedirect = Travelogue.internals.delegateRedirectFactory({}, replyMock);
            delegateRedirect(expectedUrl);
        });
    });

    describe('#actionsFactory', function () {

        var expectedUrl = '/test';
        var error = 'testing';

        it('should return a redirect when called', function (done) {

            var reqMock = {
                reply: {}
            };
            var replyMock = function () {
                return {
                    redirect: function (url) {
                        expect(url).to.exist;
                        expect(url).to.equal(expectedUrl);
                        done();
                    }
                }
            }
            var delegateMock = {};
            delegateMock.redirect = Travelogue.internals.delegateRedirectFactory({}, replyMock);

            var actions = Travelogue.internals.actionsFactory();
            actions.redirect.call(delegateMock, expectedUrl);
        });

        it('should return an error when called', function (done) {

            var cbMock = function (err) {

                expect(err).to.exist;
                expect(err.message.split(':').pop().slice(1)).to.equal(error.toString());
                done();
            };
            var delegateMock = {};
            delegateMock.error = Travelogue.internals.delegateErrorFactory(cbMock);

            var actions = Travelogue.internals.actionsFactory();
            actions.error.call(delegateMock, error);
        });
    });
});
