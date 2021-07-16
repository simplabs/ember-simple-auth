/* eslint-disable ember/no-mixins, ember/no-new-mixins */

import { next } from '@ember/runloop';
import Service from '@ember/service';
import Route from '@ember/routing/route';
import { describe, beforeEach, it } from 'mocha';
import { setupTest } from 'ember-mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';
import ApplicationRouteMixin from 'ember-simple-auth/mixins/application-route-mixin';
import InternalSession from 'ember-simple-auth/internal-session';
import EphemeralStore from 'ember-simple-auth/session-stores/ephemeral';
import * as LocationUtil from 'ember-simple-auth/utils/location';

describe('ApplicationRouteMixin', () => {
  setupTest();

  let sinon;
  let session;
  let sessionService;
  let route;
  let router;

  beforeEach(function() {
    sinon = sinonjs.createSandbox();

    this.owner.register('session-store:test', EphemeralStore);

    this.owner.register('session:main', InternalSession);
    session = this.owner.lookup('session:main');

    sessionService = this.owner.lookup('service:session');

    this.owner.register('service:cookies', Service.extend({
      read: sinon.stub(),
      clear: sinon.stub()
    }));

    this.owner.register('service:router', Service.extend({
      transitionTo() {}
    }));
    router = this.owner.lookup('service:router');

    this.owner.register('route:application', Route.extend(ApplicationRouteMixin));
    route = this.owner.lookup('route:application');
    sinon.stub(router, 'transitionTo');
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('mapping of service events to route methods', function() {
    beforeEach(function() {
      sinon.spy(route, 'sessionAuthenticated');
      sinon.spy(route, 'sessionInvalidated');
      sinon.stub(LocationUtil, 'default').returns({ replace() {} });
    });

    afterEach(function() {
      sinon.restore();
    });

    it("maps the services's 'authenticationSucceeded' event into a method call", function(done) {
      sessionService.trigger('authenticationSucceeded');

      next(() => {
        expect(route.sessionAuthenticated).to.have.been.calledOnce;
        done();
      });
    });

    it("maps the services's 'invalidationSucceeded' event into a method call", function(done) {
      sessionService.trigger('invalidationSucceeded');

      next(() => {
        expect(route.sessionInvalidated).to.have.been.calledOnce;
        done();
      });
    });

    it('does not attach the event listeners twice', function(done) {
      route.beforeModel();
      sessionService.trigger('authenticationSucceeded');

      next(() => {
        expect(route.sessionAuthenticated).to.have.been.calledOnce;
        done();
      });
    });
  });

  describe('sessionAuthenticated', function() {
    describe('when an attempted transition is stored in the session', function() {
      let attemptedTransition;

      beforeEach(function() {
        attemptedTransition = {
          retry: sinon.stub()
        };
        session.set('attemptedTransition', attemptedTransition);
      });

      it('retries that transition', function() {
        route.sessionAuthenticated();

        expect(attemptedTransition.retry).to.have.been.calledOnce;
      });

      it('removes it from the session', function() {
        route.sessionAuthenticated();

        expect(session.get('attemptedTransition')).to.be.null;
      });
    });

    describe('when a redirect target is stored in a cookie', function() {
      let cookieName = 'ember_simple_auth-redirectTarget';
      let targetUrl = 'transition/target/url';
      let clearStub;

      beforeEach(function() {
        clearStub = sinon.stub();
        this.owner.register('service:cookies', Service.extend({
          read() {
            return targetUrl;
          },
          clear: clearStub
        }));
      });

      it('transitions to the url', function() {
        route.sessionAuthenticated();

        expect(router.transitionTo).to.have.been.calledWith(targetUrl);
      });

      it('clears the cookie', function() {
        route.sessionAuthenticated();

        expect(clearStub).to.have.been.calledWith(cookieName);
      });
    });

    describe('when no attempted transition is stored in the session', function() {
      it('transitions to "index" by default', function() {
        route.sessionAuthenticated();

        expect(router.transitionTo).to.have.been.calledWith('index');
      });

      it('transitions to "routeAfterAuthentication"', function() {
        let routeAfterAuthentication = 'path/to/route';
        route.set('routeAfterAuthentication', routeAfterAuthentication);
        route.sessionAuthenticated();

        expect(router.transitionTo).to.have.been.calledWith(routeAfterAuthentication);
      });
    });
  });
});
