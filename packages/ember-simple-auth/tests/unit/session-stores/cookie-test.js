import { describe } from 'mocha';
import itBehavesLikeAStore from './shared/store-behavior';
import itBehavesLikeACookieStore from './shared/cookie-store-behavior';
import FakeCookieService from '../../helpers/fake-cookie-service';
import CookieStore from 'ember-simple-auth/session-stores/cookie';
import { setupTest } from 'ember-mocha';

describe('CookieStore', () => {
  setupTest();

  describe('StoreBehavior', function() {
    itBehavesLikeAStore({
      store(sinon, owner) {
        let store;
        let cookieService;
        owner.register('service:cookies', FakeCookieService);
        cookieService = owner.lookup('service:cookies');
        sinon.spy(cookieService, 'read');
        sinon.spy(cookieService, 'write');
        owner.register('session-store:cookie', CookieStore.extend({
          _cookieName: 'test-session',
        }));
        store = owner.lookup('session-store:cookie');
        return store;
      },
      syncExternalChanges(store) {
        store._syncData();
      }
    });
  });

  describe('CookieStoreBehavior', function() {
    itBehavesLikeACookieStore({
      store(sinon, owner, storeOptions) {
        owner.register('service:cookies', FakeCookieService);
        let cookieService = owner.lookup('service:cookies');
        sinon.spy(cookieService, 'read');
        sinon.spy(cookieService, 'write');
        owner.register('session-store:cookie', CookieStore.extend(Object.assign({
          _cookieName: 'test:session',
        }, storeOptions)));
        let store = owner.lookup('session-store:cookie');
        return store;
      },
      createStore(store) {
        return store;
      },
      renew(store, data) {
        return store._renew(data);
      },
      sync(store) {
        store._syncData();
      },
      spyRewriteCookieMethod(sinon, store) {
        sinon.spy(store, 'rewriteCookie');
        return store.rewriteCookie;
      }
    });
  });
});
