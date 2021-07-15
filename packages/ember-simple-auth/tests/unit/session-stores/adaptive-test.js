import { run } from '@ember/runloop';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';
import itBehavesLikeAStore from './shared/store-behavior';
import itBehavesLikeACookieStore from './shared/cookie-store-behavior';
import FakeCookieService from '../../helpers/fake-cookie-service';
import createAdaptiveStore from '../../helpers/create-adaptive-store';
import { setupTest } from 'ember-mocha';

describe('AdaptiveStore', () => {
  setupTest();
  describe('when localStorage is available', function() {
    itBehavesLikeAStore({
      store(sinon, owner) {
        let store;
        let cookieService;
        owner.register('service:cookies', FakeCookieService);
        cookieService = owner.lookup('service:cookies');
        sinon.spy(cookieService, 'read');
        sinon.spy(cookieService, 'write');
        store = createAdaptiveStore(cookieService, {
          _isLocal: false,
          _isLocalStorageAvailable: true,
        }, owner);
        return store;
      }
    });
  });

  describe('when localStorage is not available', function() {
    itBehavesLikeAStore({
      store(sinon, owner) {
        let store;
        let cookieService;
        owner.register('service:cookies', FakeCookieService);
        cookieService = owner.lookup('service:cookies');
        sinon.spy(cookieService, 'read');
        sinon.spy(cookieService, 'write');
        store = createAdaptiveStore(cookieService, {
          _isLocal: false,
          _isLocalStorageAvailable: false,
          _cookieName: 'test:session',
        }, owner);
        return store;
      }
    });
  });

  describe('CookieStore', function() {
    describe('Behaviour', function() {
      itBehavesLikeACookieStore({
        store(sinon, owner, storeOptions) {
          owner.register('service:cookies', FakeCookieService);
          let cookieService = owner.lookup('service:cookies');
          sinon.spy(cookieService, 'read');
          sinon.spy(cookieService, 'write');
          let store = createAdaptiveStore(cookieService, Object.assign({
            _isLocal: false,
            _isLocalStorageAvailable: false,
            _cookieName: 'test:session',
          }, storeOptions), owner);
          return store;
        },
        renew(store, data) {
          return store.get('_store')._renew(data);
        },
        sync(store) {
          store.get('_store')._syncData();
        },
        spyRewriteCookieMethod(sinon, store) {
          sinon.spy(store.get('_store'), 'rewriteCookie');
          return store.get('_store').rewriteCookie;
        }
      });
    });

    it('persists to cookie when cookie attributes change', async function() {
      let sinon = sinonjs.createSandbox();
      let store;
      let cookieService;
      let now;

      this.owner.register('service:cookies', FakeCookieService);
      cookieService = this.owner.lookup('service:cookies');
      sinon.spy(cookieService, 'read');
      sinon.spy(cookieService, 'write');
      run(() => {
        now = new Date();
        store = createAdaptiveStore(cookieService, {
          _isLocal: false,
          _isLocalStorageAvailable: false,
          _cookieName: 'test:session',
        }, this.owner);

        store.setProperties({
          cookieName:           'test:session',
          cookieExpirationTime: 60
        });
      });
      await store.persist({ key: 'value' });

      expect(cookieService.write).to.have.been.calledWith(
        'test:session-expiration_time',
        60,
        sinon.match(function({ domain, expires, path, secure }) {
          return domain === null &&
            path === '/' &&
            secure === false && expires >= new Date(now.getTime() + 60 * 1000);
        })
      );
    });
  });
});
