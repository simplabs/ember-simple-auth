import Ember from 'ember';
import ObjectProxy from '@ember/object/proxy';
import Service from '@ember/service';
import Evented from '@ember/object/evented';
import { next } from '@ember/runloop';
import EmberObject, { set } from '@ember/object';
import { registerDeprecationHandler } from '@ember/debug';
import { describe, beforeEach, it } from 'mocha';
import { setupTest } from 'ember-mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';
import Session from 'ember-simple-auth/services/session';
import * as LocationUtil from 'ember-simple-auth/utils/location';

describe('SessionService', () => {
  setupTest();

  let sinon;
  let sessionService;
  let session;

  beforeEach(function() {
    sinon = sinonjs.createSandbox();
    this.owner.register('authorizer:custom', EmberObject.extend({
      authorize() {}
    }));
    this.owner.register('session:main', ObjectProxy.extend(Evented, {
      init() {
        this._super(...arguments);
        this.content = {};
      }
    }));

    session = this.owner.lookup('session:main');
    this.owner.register('service:session', Session);
    sessionService = this.owner.lookup('service:session');
  });

  afterEach(function() {
    sinon.restore();
  });

  it('forwards the "authenticationSucceeded" event from the session', function(done) {
    let deprecations = [];
    registerDeprecationHandler((message, options, next) => {
      deprecations.push(message);

      next(message, options);
    });
    let triggered = false;
    sinon.stub(sessionService, 'handleAuthentication');
    sessionService.one('authenticationSucceeded', () => (triggered = true));
    session.trigger('authenticationSucceeded');

    next(() => {
      expect(triggered).to.be.true;
      expect(deprecations.filter(deprecation => deprecation.includes('Ember Simple Auth:'))).to.have.length(1); // the call to .one above triggers a deprecation but forwarding the event should *not* trigger a deprecation
      done();
    });
  });

  it('forwards the "invalidationSucceeded" event from the session', function(done) {
    let deprecations = [];
    registerDeprecationHandler((message, options, next) => {
      deprecations.push(message);

      next(message, options);
    });
    let triggered = false;
    sessionService.one('invalidationSucceeded', () => (triggered = true));
    session.trigger('invalidationSucceeded');

    next(() => {
      expect(triggered).to.be.true;
      expect(deprecations.filter(deprecation => deprecation.includes('Ember Simple Auth:'))).to.have.length(1); // the call to .one above triggers a deprecation but forwarding the event should *not* trigger a deprecation
      done();
    });
  });

  it('deprecates using the "Evented" API', function() {
    let deprecations = [];
    registerDeprecationHandler((message, options, next) => {
      deprecations.push(message);

      next(message, options);
    });

    let handler = () => {};
    sessionService.trigger('invalidationSucceeded');
    sessionService.on('invalidationSucceeded', handler);
    sessionService.off('invalidationSucceeded', handler);
    sessionService.has('invalidationSucceeded');
    sessionService.one('invalidationSucceeded', handler);

    let emberSimpleAuthDeprecations = deprecations.filter(deprecation => deprecation.includes('Ember Simple Auth:'));
    expect(emberSimpleAuthDeprecations).to.have.length(5);
    for (let deprecation of emberSimpleAuthDeprecations) {
      expect(deprecation).to.eq("Ember Simple Auth: The session service's events API is deprecated; to add custom behavior to the authentication or invalidation handling, override the handleAuthentication or handleInvalidation methods.");
    }
  });

  describe('isAuthenticated', function() {
    it('is read from the session', function() {
      session.set('isAuthenticated', true);

      expect(sessionService.get('isAuthenticated')).to.be.true;
    });

    it('is read-only', function() {
      expect(() => {
        sessionService.set('isAuthenticated', false);
      }).to.throw;
    });
  });

  describe('store', function() {
    it('is read from the session', function() {
      session.set('store', 'some store');

      expect(sessionService.get('store')).to.eq('some store');
    });

    it('is read-only', function() {
      expect(() => {
        sessionService.set('store', 'some other store');
      }).to.throw;
    });
  });

  describe('attemptedTransition', function() {
    it('is read from the session', function() {
      session.set('attemptedTransition', 'some transition');

      expect(sessionService.get('attemptedTransition')).to.eq('some transition');
    });

    it('is written back to the session', function() {
      sessionService.set('attemptedTransition', 'some other transition');

      expect(session.get('attemptedTransition')).to.eq('some other transition');
    });
  });

  describe('data', function() {
    it("is read from the session's content", function() {
      session.set('some', 'data');

      expect(sessionService.get('data')).to.eql({ some: 'data' });
    });

    it("is written back to the session's content", function() {
      sessionService.set('data.some', { other: 'data' });

      expect(session.content).to.eql({ some: { other: 'data' } });
    });

    it('can be set with Ember.set', function() {
      set(sessionService, 'data.emberSet', 'ember-set-data');

      expect(session.content).to.eql({ emberSet: 'ember-set-data' });
    });

    it('is read-only', function() {
      expect(() => {
        sessionService.set('data', false);
      }).to.throw;
    });
  });

  describe('authenticate', function() {
    beforeEach(function() {
      session.reopen({
        authenticate() {
          return 'value';
        }
      });
    });

    it('authenticates the session', function() {
      sinon.spy(session, 'authenticate');
      sessionService.authenticate({ some: 'argument' });

      expect(session.authenticate).to.have.been.calledWith({ some: 'argument' });
    });

    it("returns the session's authentication return value", function() {
      expect(sessionService.authenticate()).to.eq('value');
    });
  });

  describe('invalidate', function() {
    beforeEach(function() {
      session.reopen({
        invalidate() {
          return 'value';
        }
      });
    });

    it('invalidates the session', function() {
      sinon.spy(session, 'invalidate');
      sessionService.invalidate({ some: 'argument' });

      expect(session.invalidate).to.have.been.calledWith({ some: 'argument' });
    });

    it("returns the session's invalidation return value", function() {
      expect(sessionService.invalidate()).to.eq('value');
    });
  });

  describe('requireAuthentication', function() {
    let transition;
    let router;

    beforeEach(function() {
      transition = {
        intent: {
          url: '/transition/target/url'
        },
        send() {}
      };
      this.owner.register('service:router', Service.extend({
        transitionTo() {}
      }));
      router = this.owner.lookup('service:router');

      sinon.spy(transition, 'send');
      sinon.spy(router, 'transitionTo');
    });

    describe('if the session is authenticated', function() {
      beforeEach(function() {
        session.set('isAuthenticated', true);
      });

      it('returns true', function() {
        let result = sessionService.requireAuthentication(transition, 'login');

        expect(result).to.be.true;
      });

      describe('if a route name is passed as second argument', function() {
        it('does not transition to the authentication route', function() {
          sessionService.requireAuthentication(transition, 'login');

          expect(router.transitionTo).to.not.have.been.calledWith('login');
        });
      });

      describe('if a callback function is passed as second argument', function() {
        it('does not invoke the callback', function() {
          let callback = sinon.spy();
          sessionService.requireAuthentication(transition, callback);

          expect(callback).to.not.have.been.called;
        });
      });
    });

    describe('if the session is not authenticated', function() {
      beforeEach(function() {
        session.set('isAuthenticated', false);
      });

      it('returns false', function() {
        let result = sessionService.requireAuthentication(transition, 'login');

        expect(result).to.be.false;
      });

      describe('if a route name is passed as second argument', function() {
        it('transitions to the specified route', function() {
          sessionService.requireAuthentication(transition, 'login');

          expect(router.transitionTo).to.have.been.calledWith('login');
        });
      });

      describe('if a callback function is passed as second argument', function() {
        it('does invokes the callback', function() {
          let callback = sinon.spy();
          sessionService.requireAuthentication(transition, callback);

          expect(callback).to.have.been.calledOnce;
        });
      });

      describe('if a transition is passed', function() {
        it('stores it in the session', function() {
          sessionService.requireAuthentication(transition, 'login');

          expect(sessionService.get('attemptedTransition')).to.eq(transition);
        });

        it('sets the redirectTarget cookie in fastboot', function() {
          this.owner.register('service:fastboot', Service.extend({
            isFastBoot: true,
            init() {
              this._super(...arguments);
              this.request = {
                protocol: 'https'
              };
            },
          }));
          let writeCookieStub = sinon.stub();
          this.owner.register('service:cookies', Service.extend({
            write: writeCookieStub
          }));

          let cookieName = 'ember_simple_auth-redirectTarget';

          sessionService.requireAuthentication(transition, 'login');

          expect(writeCookieStub).to.have.been.calledWith(cookieName, transition.intent.url, {
            path: '/',
            secure: true
          });
        });
      });

      describe('if no transition is passed', function() {
        it("does not set the session's 'attemptedTransition' property", function() {
          sessionService.requireAuthentication(null, 'login');

          expect(sessionService.get('attemptedTransition')).to.be.undefined;
        });

        it('does not set the redirectTarget cookie in fastboot', function() {
          this.owner.register('service:fastboot', Service.extend({
            isFastBoot: true,
            init() {
              this._super(...arguments);
              this.request = {
                protocol: 'https'
              };
            },
          }));
          let writeCookieStub = sinon.stub();
          this.owner.register('service:cookies', Service.extend({
            write: writeCookieStub
          }));

          sessionService.requireAuthentication(null, 'login');

          expect(writeCookieStub).to.not.have.been.called;
        });
      });
    });
  });

  describe('prohibitAuthentication', function() {
    let router;

    beforeEach(function() {
      this.owner.register('service:router', Service.extend({
        transitionTo() {}
      }));
      router = this.owner.lookup('service:router');

      sinon.spy(router, 'transitionTo');
    });

    describe('if the session is not authenticated', function() {
      beforeEach(function() {
        session.set('isAuthenticated', false);
      });

      it('returns true', function() {
        let result = sessionService.prohibitAuthentication('index');

        expect(result).to.be.true;
      });

      describe('if a route name is passed as first argument', function() {
        it('does not transition to the route', function() {
          sessionService.prohibitAuthentication('index');

          expect(router.transitionTo).to.not.have.been.called;
        });
      });

      describe('if a callback function is passed as first argument', function() {
        it('does not invoke the callback', function() {
          let callback = sinon.spy();
          sessionService.prohibitAuthentication(callback);

          expect(callback).to.not.have.been.called;
        });
      });
    });

    describe('if the session is authenticated', function() {
      beforeEach(function() {
        session.set('isAuthenticated', true);
      });

      it('returns false', function() {
        let result = sessionService.prohibitAuthentication('login');

        expect(result).to.be.false;
      });

      describe('if a route name is passed as first argument', function() {
        it('transitions to the specified route', function() {
          sessionService.prohibitAuthentication('index');

          expect(router.transitionTo).to.have.been.calledWith('index');
        });
      });

      describe('if a callback function is passed as first argument', function() {
        it('invokes the callback', function() {
          let callback = sinon.spy();
          sessionService.prohibitAuthentication(callback);

          expect(callback).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('handleAuthentication', function() {
    let router;

    beforeEach(function() {
      this.owner.register('service:router', Service.extend({
        transitionTo() {}
      }));
      router = this.owner.lookup('service:router');
      sinon.spy(router, 'transitionTo');
    });

    describe('when an attempted transition is stored in the session', function() {
      let attemptedTransition;

      beforeEach(function() {
        attemptedTransition = {
          retry: sinon.stub()
        };
        session.set('attemptedTransition', attemptedTransition);
      });

      it('retries that transition', function() {
        sessionService.handleAuthentication();

        expect(attemptedTransition.retry).to.have.been.calledOnce;
      });

      it('removes it from the session', function() {
        sessionService.handleAuthentication();

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
        sessionService.handleAuthentication();

        expect(router.transitionTo).to.have.been.calledWith(targetUrl);
      });

      it('clears the cookie', function() {
        sessionService.handleAuthentication();

        expect(clearStub).to.have.been.calledWith(cookieName);
      });
    });

    describe('when no attempted transition is stored in the session', function() {
      it('transitions to "routeAfterAuthentication"', function() {
        let routeAfterAuthentication = 'index';
        sessionService.handleAuthentication(routeAfterAuthentication);

        expect(router.transitionTo).to.have.been.calledWith(routeAfterAuthentication);
      });
    });
  });

  describe('handleInvalidation', function() {
    let router;

    describe('when running in FastBoot', function() {
      beforeEach(function() {
        this.owner.register('service:fastboot', Service.extend({
          isFastBoot: true
        }));
        this.owner.register('service:router', Service.extend({
          transitionTo() {}
        }));
        router = this.owner.lookup('service:router');
        sinon.spy(router, 'transitionTo');
      });

      it('transitions to the route', function() {
        sessionService.handleInvalidation('index');

        expect(router.transitionTo).to.have.been.calledWith('index');
      });
    });

    describe('when not running in FastBoot', function() {
      beforeEach(function() {
        this.owner.register('service:fastboot', Service.extend({
          isFastBoot: false
        }));
        sinon.stub(LocationUtil, 'default').returns({ replace() {} });
        sinon.spy(LocationUtil.default(), 'replace');
        // eslint-disable-next-line ember/no-ember-testing-in-module-scope
        Ember.testing = false;
      });

      afterEach(function() {
        // eslint-disable-next-line ember/no-ember-testing-in-module-scope
        Ember.testing = true;
      });

      it('replaces the location with the route', function() {
        sessionService.handleInvalidation('index');

        expect(LocationUtil.default().replace).to.have.been.calledWith('index');
      });
    });
  });
});
