import RSVP from 'rsvp';
import { next } from '@ember/runloop';
import { setOwner } from '@ember/application';
import { describe, beforeEach, it } from 'mocha';
import { setupTest } from 'ember-mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';
import InternalSession from 'ember-simple-auth/internal-session';
import EphemeralStore from 'ember-simple-auth/session-stores/ephemeral';
import Authenticator from 'ember-simple-auth/authenticators/base';

describe('InternalSession', () => {
  setupTest();

  let sinon;
  let session;
  let store;
  let authenticator;

  beforeEach(function() {
    sinon = sinonjs.createSandbox();

    authenticator = Authenticator.create();
    this.owner.register('authenticator:test', authenticator, { instantiate: false });
    this.owner.register('session-store:test', EphemeralStore);
    store = this.owner.lookup('session-store:test');

    session = InternalSession.create(this.owner.ownerInjection());
    setOwner(session, this.owner);
  });

  afterEach(function() {
    sinon.restore();
  });

  it('does not allow data to be stored for the key "authenticated"', function() {
    expect(() => {
      session.set('authenticated', 'test');
    }).to.throw(Error);
  });

  function itHandlesAuthenticatorEvents(preparation) {
    describe('when the authenticator triggers the "sessionDataUpdated" event', function() {
      beforeEach(function() {
        return preparation.call();
      });

      it('stores the data the event is triggered with in its authenticated section', function(done) {
        authenticator.trigger('sessionDataUpdated', { some: 'property' });

        next(() => {
          expect(session.get('authenticated')).to.eql({ some: 'property', authenticator: 'authenticator:test' });
          done();
        });
      });
    });

    describe('when the authenticator triggers the "invalidated" event', function() {
      beforeEach(function() {
        return preparation.call();
      });

      it('is not authenticated', function(done) {
        authenticator.trigger('sessionDataInvalidated');

        next(() => {
          expect(session.get('isAuthenticated')).to.be.false;
          done();
        });
      });

      it('clears its authenticated section', function(done) {
        session.set('content', { some: 'property', authenticated: { some: 'other property' } });
        authenticator.trigger('sessionDataInvalidated');

        next(() => {
          expect(session.get('content')).to.eql({ some: 'property', authenticated: {} });
          done();
        });
      });

      it('updates the store', function(done) {
        authenticator.trigger('sessionDataInvalidated');

        next(async() => {
          let properties = await store.restore();

          expect(properties.authenticated).to.eql({});

          done();
        });
      });

      it('triggers the "invalidationSucceeded" event', function(done) {
        let triggered = false;
        session.one('invalidationSucceeded', () => {
          triggered = true;
        });
        authenticator.trigger('sessionDataInvalidated');

        next(() => {
          expect(triggered).to.be.true;
          done();
        });
      });
    });
  }

  describe('restore', function() {
    function itDoesNotRestore() {
      it('returns a rejecting promise', async function() {
        try {
          await session.restore();
          expect(false).to.be.true;
        } catch (_error) {
          expect(true).to.be.true;
        }
      });

      it('is not authenticated', async function() {
        try {
          await session.restore();
        } catch (_error) {
          expect(session.get('isAuthenticated')).to.be.false;
        }
      });

      it('clears its authenticated section', async function() {
        store.persist({ some: 'property', authenticated: { some: 'other property' } });

        try {
          await session.restore();
        } catch (_error) {
          expect(session.get('content')).to.eql({ some: 'property', authenticated: {} });
        }
      });
    }

    describe('when the restored data contains an authenticator factory', function() {
      beforeEach(function() {
        store.persist({ authenticated: { authenticator: 'authenticator:test' } });
      });

      describe('when the authenticator resolves restoration', function() {
        beforeEach(function() {
          sinon.stub(authenticator, 'restore').returns(RSVP.resolve({ some: 'property' }));
        });

        it('returns a resolving promise', async function() {
          try {
            await session.restore();
            expect(true).to.be.true;
          } catch (_error) {
            expect(false).to.be.true;
          }
        });

        it('is authenticated', async function() {
          await session.restore();

          expect(session.get('isAuthenticated')).to.be.true;
        });

        it('stores the data the authenticator resolves with in its authenticated section', async function() {
          await store.persist({ authenticated: { authenticator: 'authenticator:test' } });
          await session.restore();
          let properties = await store.restore();

          delete properties.authenticator;

          expect(session.get('authenticated')).to.eql({ some: 'property', authenticator: 'authenticator:test' });
        });

        it('persists its content in the store', async function() {
          await store.persist({ authenticated: { authenticator: 'authenticator:test' }, someOther: 'property' });
          await session.restore();
          let properties = await store.restore();

          delete properties.authenticator;

          expect(properties).to.eql({ authenticated: { some: 'property', authenticator: 'authenticator:test' }, someOther: 'property' });
        });

        it('persists the authenticator factory in the store', async function() {
          await session.restore();
          let properties = await store.restore();

          expect(properties.authenticated.authenticator).to.eql('authenticator:test');
        });

        it('does not trigger the "authenticationSucceeded" event', async function() {
          let triggered = false;
          session.one('authenticationSucceeded', () => (triggered = true));
          await session.restore();

          expect(triggered).to.be.false;
        });

        itHandlesAuthenticatorEvents(async() => {
          await session.restore();
        });
      });

      describe('when the authenticator rejects restoration', function() {
        beforeEach(function() {
          sinon.stub(authenticator, 'restore').returns(RSVP.reject());
        });

        itDoesNotRestore();
      });
    });

    describe('when the restored data does not contain an authenticator factory', function() {
      itDoesNotRestore();
    });

    describe('when the store rejects restoration', function() {
      beforeEach(function() {
        sinon.stub(store, 'restore').returns(RSVP.Promise.reject());
      });

      it('is not authenticated', async function() {
        await session.restore();

        expect(session.get('isAuthenticated')).to.be.false;
      });
    });

    describe('when the store rejects persistance', function() {
      beforeEach(function() {
        sinon.stub(store, 'persist').returns(RSVP.reject());
      });

      it('is not authenticated', async function() {
        await session.restore();

        expect(session.get('isAuthenticated')).to.be.false;
      });
    });
  });

  describe('authentication', function() {
    describe('when the authenticator resolves authentication', function() {
      beforeEach(function() {
        sinon.stub(authenticator, 'authenticate').returns(RSVP.resolve({ some: 'property' }));
      });

      it('is authenticated', async function() {
        await session.authenticate('authenticator:test');

        expect(session.get('isAuthenticated')).to.be.true;
      });

      it('returns a resolving promise', async function() {
        try {
          await session.authenticate('authenticator:test');
          expect(true).to.be.true;
        } catch (_error) {
          expect(false).to.be.true;
        }
      });

      it('stores the data the authenticator resolves with in its authenticated section', async function() {
        await session.authenticate('authenticator:test');

        expect(session.get('authenticated')).to.eql({ some: 'property', authenticator: 'authenticator:test' });
      });

      it('persists its content in the store', async function() {
        await session.authenticate('authenticator:test');
        let properties = await store.restore();

        delete properties.authenticator;

        expect(properties).to.eql({ authenticated: { some: 'property', authenticator: 'authenticator:test' } });
      });

      it('persists the authenticator factory in the store', async function() {
        await session.authenticate('authenticator:test');
        let properties = await store.restore();

        expect(properties.authenticated.authenticator).to.eql('authenticator:test');
      });

      it('triggers the "authenticationSucceeded" event', async function() {
        let triggered = false;
        session.one('authenticationSucceeded', () => (triggered = true));

        await session.authenticate('authenticator:test');

        expect(triggered).to.be.true;
      });

      itHandlesAuthenticatorEvents(async() => {
        await session.authenticate('authenticator:test');
      });
    });

    describe('when the authenticator rejects authentication', function() {
      it('is not authenticated', async function() {
        sinon.stub(authenticator, 'authenticate').returns(RSVP.reject('error auth'));

        try {
          await session.authenticate('authenticator:test');
        } catch (_error) {
          expect(session.get('isAuthenticated')).to.be.false;
        }
      });

      it('returns a rejecting promise', async function() {
        sinon.stub(authenticator, 'authenticate').returns(RSVP.reject('error auth'));

        try {
          await session.authenticate('authenticator:test');
          expect(false).to.be.true;
        } catch (_error) {
          expect(true).to.be.true;
        }
      });

      it('clears its authenticated section', async function() {
        sinon.stub(authenticator, 'authenticate').returns(RSVP.reject('error auth'));
        session.set('content', { some: 'property', authenticated: { some: 'other property' } });

        try {
          await session.authenticate('authenticator:test');
        } catch (_error) {
          expect(session.get('content')).to.eql({ some: 'property', authenticated: {} });
        }
      });

      it('updates the store', async function() {
        sinon.stub(authenticator, 'authenticate').returns(RSVP.reject('error auth'));
        session.set('content', { some: 'property', authenticated: { some: 'other property' } });

        try {
          await session.authenticate('authenticator:test');
        } catch (_error) {
          let properties = await store.restore();

          expect(properties).to.eql({ some: 'property', authenticated: {} });
        }
      });

      it('does not trigger the "authenticationSucceeded" event', async function() {
        let triggered = false;
        sinon.stub(authenticator, 'authenticate').returns(RSVP.reject('error auth'));
        session.one('authenticationSucceeded', () => (triggered = true));

        try {
          await session.authenticate('authenticator:test');
        } catch (_error) {
          expect(triggered).to.be.false;
        }
      });
    });

    describe('when the store rejects persistance', function() {
      beforeEach(function() {
        sinon.stub(store, 'persist').returns(RSVP.reject());
      });

      it('is not authenticated', async function() {
        await session.authenticate('authenticator:test');

        expect(session.get('isAuthenticated')).to.be.false;
      });
    });
  });

  describe('invalidation', function() {
    beforeEach(async function() {
      sinon.stub(authenticator, 'authenticate').returns(RSVP.resolve({ some: 'property' }));
      await session.authenticate('authenticator:test');
    });

    it('unsets the attemptedTransition', function() {
      session.set('attemptedTransition', { some: 'transition' });
      session.invalidate();

      expect(session.get('attemptedTransition')).to.be.null;
    });


    describe('when invalidate gets called with additional params', function() {
      beforeEach(function() {
        sinon.spy(authenticator, 'invalidate');
      });

      it('passes the params on to the authenticators invalidate method', function() {
        let param = { some: 'random data' };
        session.invalidate(param);
        expect(authenticator.invalidate).to.have.been.calledWith(session.get('authenticated'), param);
      });
    });

    describe('when the authenticator resolves invalidation', function() {
      beforeEach(function() {
        sinon.stub(authenticator, 'invalidate').returns(RSVP.resolve());
      });

      it('is not authenticated', async function() {
        await session.invalidate();

        expect(session.get('isAuthenticated')).to.be.false;
      });

      it('returns a resolving promise', async function() {
        try {
          await session.invalidate();
          expect(true).to.be.true;
        } catch (_error) {
          expect(false).to.be.true;
        }
      });

      it('clears its authenticated section', async function() {
        session.set('content', { some: 'property', authenticated: { some: 'other property' } });

        await session.invalidate();

        expect(session.get('content')).to.eql({ some: 'property', authenticated: {} });
      });

      it('updates the store', async function() {
        session.set('content', { some: 'property', authenticated: { some: 'other property' } });

        await session.invalidate();
        let properties = await store.restore();

        expect(properties).to.eql({ some: 'property', authenticated: {} });
      });

      it('triggers the "invalidationSucceeded" event', async function() {
        let triggered = false;
        session.one('invalidationSucceeded', () => (triggered = true));

        await session.invalidate();

        expect(triggered).to.be.true;
      });
    });

    describe('when the authenticator rejects invalidation', function() {
      it('stays authenticated', async function() {
        sinon.stub(authenticator, 'invalidate').returns(RSVP.reject('error'));

        try {
          await session.invalidate();
        } catch (_error) {
          expect(session.get('isAuthenticated')).to.be.true;
        }
      });

      it('returns a rejecting promise', async function() {
        sinon.stub(authenticator, 'invalidate').returns(RSVP.reject('error'));

        try {
          await session.invalidate();
          expect(false).to.be.true;
        } catch (_error) {
          expect(true).to.be.true;
        }
      });

      it('keeps its content', async function() {
        sinon.stub(authenticator, 'invalidate').returns(RSVP.reject('error'));

        try {
          await session.invalidate();
        } catch (_error) {
          expect(session.get('authenticated')).to.eql({ some: 'property', authenticator: 'authenticator:test' });
        }
      });

      it('does not update the store', async function() {
        sinon.stub(authenticator, 'invalidate').returns(RSVP.reject('error'));

        try {
          await session.invalidate();
        } catch (_error) {
          let properties = await store.restore();

          expect(properties).to.eql({ authenticated: { some: 'property', authenticator: 'authenticator:test' } });
        }
      });

      it('does not trigger the "invalidationSucceeded" event', async function() {
        sinon.stub(authenticator, 'invalidate').returns(RSVP.reject('error'));
        let triggered = false;
        session.one('invalidationSucceeded', () => (triggered = true));

        try {
          await session.invalidate();
        } catch (_error) {
          expect(triggered).to.be.false;
        }
      });

      itHandlesAuthenticatorEvents(function() {});
    });

    describe('when the store rejects persistance', function() {
      beforeEach(function() {
        sinon.stub(store, 'persist').returns(RSVP.reject());
      });

      it('rejects but is not authenticated', async function() {
        try {
          await session.invalidate();
        } catch (_error) {
          expect(session.get('isAuthenticated')).to.be.false;
        }
      });
    });
  });

  describe("when the session's content changes", function() {
    describe('when a single property is set', function() {
      describe('when the property is private (starts with an "_")', function() {
        beforeEach(function() {
          session.set('_some', 'property');
        });

        it('does not persist its content in the store', async function() {
          let properties = await store.restore();
          delete properties.authenticator;

          expect(properties).to.eql({});
        });
      });

      describe('when the property is not private (does not start with an "_")', function() {
        beforeEach(function() {
          session.set('some', 'property');
        });

        it('persists its content in the store', async function() {
          let properties = await store.restore();
          delete properties.authenticator;

          expect(properties).to.eql({ some: 'property', authenticated: {} });
        });
      });
    });

    describe('when multiple properties are set at once', function() {
      beforeEach(function() {
        session.set('some', 'property');
        session.setProperties({ another: 'property', multiple: 'properties' });
      });

      it('persists its content in the store', async function() {
        let properties = await store.restore();
        delete properties.authenticator;

        expect(properties).to.eql({ some: 'property', another: 'property', multiple: 'properties', authenticated: {} });
      });
    });
  });

  describe('when the store triggers the "sessionDataUpdated" event', function() {
    describe('when the session is currently busy', function() {
      beforeEach(function() {
        sinon.stub(store, 'restore').returns(new RSVP.Promise((resolve) => {
          next(() => resolve({ some: 'other property' }));
        }));
      });

      it('does not process the event', async function() {
        sinon.spy(authenticator, 'restore');
        let restoration = session.restore();
        store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });
        await restoration;

        expect(authenticator.restore).to.not.have.been.called;
      });
    });

    describe('when the session is not currently busy', function() {
      describe('when there is an authenticator factory in the event data', function() {
        describe('when the authenticator resolves restoration', function() {
          beforeEach(function() {
            sinon.stub(authenticator, 'restore').returns(RSVP.resolve({ some: 'other property' }));
          });

          it('is authenticated', function(done) {
            store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

            next(() => {
              expect(session.get('isAuthenticated')).to.be.true;
              done();
            });
          });

          it('stores the data the authenticator resolves with in its authenticated section', function(done) {
            store.trigger('sessionDataUpdated', { some: 'property', authenticated: { authenticator: 'authenticator:test' } });

            next(() => {
              expect(session.get('authenticated')).to.eql({ some: 'other property', authenticator: 'authenticator:test' });
              done();
            });
          });

          it('persists its content in the store', function(done) {
            store.trigger('sessionDataUpdated', { some: 'property', authenticated: { authenticator: 'authenticator:test' } });

            next(async() => {
              let properties = await store.restore();

              expect(properties).to.eql({ some: 'property', authenticated: { some: 'other property', authenticator: 'authenticator:test' } });

              done();
            });
          });

          describe('when the session is already authenticated', function() {
            beforeEach(function() {
              session.set('isAuthenticated', true);
            });

            it('does not trigger the "authenticationSucceeded" event', function(done) {
              let triggered = false;
              session.one('authenticationSucceeded', () => (triggered = true));
              store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

              next(() => {
                expect(triggered).to.be.false;
                done();
              });
            });
          });

          describe('when the session is not already authenticated', function() {
            beforeEach(function() {
              session.set('isAuthenticated', false);
            });

            it('triggers the "authenticationSucceeded" event', function(done) {
              let triggered = false;
              session.one('authenticationSucceeded', () => (triggered = true));
              store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

              next(() => {
                expect(triggered).to.be.true;
                done();
              });
            });
          });
        });

        describe('when the authenticator rejects restoration', function() {
          beforeEach(function() {
            sinon.stub(authenticator, 'restore').returns(RSVP.reject());
          });

          it('is not authenticated', function(done) {
            store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

            next(() => {
              expect(session.get('isAuthenticated')).to.be.false;
              done();
            });
          });

          it('clears its authenticated section', function(done) {
            session.set('content', { some: 'property', authenticated: { some: 'other property' } });
            store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

            next(() => {
              expect(session.get('content')).to.eql({ some: 'other property', authenticated: {} });
              done();
            });
          });

          it('updates the store', function(done) {
            session.set('content', { some: 'property', authenticated: { some: 'other property' } });
            store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

            next(async() => {
              let properties = await store.restore();

              expect(properties).to.eql({ some: 'other property', authenticated: {} });

              done();
            });
          });

          describe('when the session is authenticated', function() {
            beforeEach(function() {
              session.set('isAuthenticated', true);
            });

            it('triggers the "invalidationSucceeded" event', function(done) {
              let triggered = false;
              session.one('invalidationSucceeded', () => (triggered = true));
              store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

              next(() => {
                expect(triggered).to.be.true;
                done();
              });
            });
          });

          describe('when the session is not authenticated', function() {
            beforeEach(function() {
              session.set('isAuthenticated', false);
            });

            it('does not trigger the "invalidationSucceeded" event', function(done) {
              let triggered = false;
              session.one('invalidationSucceeded', () => (triggered = true));
              store.trigger('sessionDataUpdated', { some: 'other property', authenticated: { authenticator: 'authenticator:test' } });

              next(() => {
                expect(triggered).to.be.false;
                done();
              });
            });
          });
        });
      });

      describe('when there is no authenticator factory in the store', function() {
        it('is not authenticated', function(done) {
          store.trigger('sessionDataUpdated', { some: 'other property' });

          next(() => {
            expect(session.get('isAuthenticated')).to.be.false;
            done();
          });
        });

        it('clears its authenticated section', function(done) {
          session.set('content', { some: 'property', authenticated: { some: 'other property' } });
          store.trigger('sessionDataUpdated', { some: 'other property' });

          next(() => {
            expect(session.get('content')).to.eql({ some: 'other property', authenticated: {} });
            done();
          });
        });

        it('updates the store', function(done) {
          session.set('content', { some: 'property', authenticated: { some: 'other property' } });
          store.trigger('sessionDataUpdated', { some: 'other property' });

          next(async() => {
            let properties = await store.restore();

            expect(properties).to.eql({ some: 'other property', authenticated: {} });

            done();
          });
        });

        describe('when the session is authenticated', function() {
          beforeEach(function() {
            session.set('isAuthenticated', true);
          });

          it('triggers the "invalidationSucceeded" event', function(done) {
            let triggered = false;
            session.one('invalidationSucceeded', () => (triggered = true));
            store.trigger('sessionDataUpdated', { some: 'other property' });

            next(() => {
              expect(triggered).to.be.true;
              done();
            });
          });
        });

        describe('when the session is not authenticated', function() {
          beforeEach(function() {
            session.set('isAuthenticated', false);
          });

          it('does not trigger the "invalidationSucceeded" event', function(done) {
            let triggered = false;
            session.one('invalidationSucceeded', () => (triggered = true));
            store.trigger('sessionDataUpdated', { some: 'other property' });

            next(() => {
              expect(triggered).to.be.false;
              done();
            });
          });

          it('it does not trigger the "sessionInvalidationFailed" event', async function() {
            let triggered = false;
            session.one('sessionInvalidationFailed', () => (triggered = true));

            await session.invalidate();

            expect(triggered).to.be.false;
          });

          it('it returns with a resolved Promise', async function() {
            try {
              await session.invalidate();
              expect(true).to.be.true;
            } catch (_error) {
              expect(false).to.be.true;
            }
          });
        });
      });
    });
  });

  it('does not share the content object between multiple instances', function() {
    let session2 = InternalSession.create(this.owner.ownerInjection());

    expect(session2.get('content')).to.not.equal(session.get('content'));
  });
});
