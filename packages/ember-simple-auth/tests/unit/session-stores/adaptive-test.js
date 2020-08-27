import { run } from '@ember/runloop';
import {
  describe,
  beforeEach,
  afterEach,
  it
} from 'mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';
import Adaptive from 'ember-simple-auth/session-stores/adaptive';
import LocalStorage from 'ember-simple-auth/session-stores/local-storage';
import itBehavesLikeAStore from './shared/store-behavior';
import itBehavesLikeACookieStore from './shared/cookie-store-behavior';
import FakeCookieService from '../../helpers/fake-cookie-service';
import createAdaptiveStore from '../../helpers/create-adaptive-store';

describe('AdaptiveStore', () => {
  let sinon;
  let store;

  beforeEach(function() {
    sinon = sinonjs.createSandbox();
  });

  afterEach(function() {
    store.clear();
    sinon.restore();
  });

  describe('when localStorage is available', function() {
    beforeEach(function() {
      store = Adaptive.extend({
        _createStore(storeType, options) {
          return LocalStorage.create({ _isFastBoot: false }, options);
        }
      }).create({
        _isLocalStorageAvailable: true
      });
    });

    itBehavesLikeAStore({
      store() {
        return store;
      }
    });
  });

  describe('when localStorage is not available', function() {
    let cookieService;
    beforeEach(function() {
      cookieService = FakeCookieService.create();
      sinon.spy(cookieService, 'read');
      sinon.spy(cookieService, 'write');
      store = createAdaptiveStore(cookieService, {
        _isLocal: false,
        _cookies: cookieService,
      });
    });

    itBehavesLikeAStore({
      store() {
        return store;
      }
    });

    itBehavesLikeACookieStore({
      createStore(cookieService, options = {}) {
        options._isLocalStorageAvailable = false;
        return createAdaptiveStore(cookieService, options, {
          _cookies: cookieService,
          _fastboot: { isFastBoot: false },
        });
      },
      renew(store, data) {
        return store.get('_store')._renew(data);
      },
      sync(store) {
        store.get('_store')._syncData();
      },
      spyRewriteCookieMethod(store) {
        sinon.spy(store.get('_store'), 'rewriteCookie');
        return store.get('_store').rewriteCookie;
      }
    });

    it('persists to cookie when cookie attributes change', function() {
      let now = new Date();

      run(() => {
        store.persist({ key: 'value' });
        store.setProperties({
          cookieName:           'test:session',
          cookieExpirationTime: 60,
          sameSite:             'Strict',
        });
      });

      expect(cookieService.write).to.have.been.calledWith(
        'test:session-expiration_time',
        60,
        sinon.match(function({ domain, expires, path, secure, sameSite }) {
          return domain === null &&
            path === '/' &&
            secure === false && expires >= new Date(now.getTime() + 60 * 1000) &&
            sameSite === 'Strict';
        })
      );
    });
  });
});
