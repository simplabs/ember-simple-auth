import { next, run } from '@ember/runloop';
import { registerWarnHandler } from '@ember/debug';
import {
  describe,
  beforeEach,
  afterEach,
  it
} from 'mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';
import FakeCookieService from '../../../helpers/fake-cookie-service';

let warnings;
registerWarnHandler((message, options, next) => {
  // in case a deprecation is issued before a test is started
  if (!warnings) {
    warnings = [];
  }

  warnings.push(message);
  next(message, options);
});

export default function(options) {
  let sinon;
  let renew;
  let sync;
  let spyRewriteCookieMethod;

  // eslint-disable-next-line mocha/no-top-level-hooks
  beforeEach(function() {
    sinon = sinonjs.createSandbox();
    renew = options.renew;
    sync = options.sync;
    spyRewriteCookieMethod = options.spyRewriteCookieMethod;
  });

  // eslint-disable-next-line mocha/no-top-level-hooks
  afterEach(function() {
    sinon.restore();
  });

  describe('#persist', function() {
    let store;
    beforeEach(function() {
      warnings = [];
      store = options.store(sinon, this.owner);
    });

    it('respects the configured cookieName', async function() {
      let cookieService = store.get('_cookies');
      await store.persist({ key: 'value' });

      expect(cookieService.write).to.have.been.calledWith(
        'test:session',
        JSON.stringify({ key: 'value' }),
        { domain: null, expires: null, path: '/', sameSite: null, secure: false }
      );
    });

    it('respects the configured cookieDomain', async function() {
      let cookieService = store.get('_cookies');
      run(() => {
        store.set('cookieName', 'session-cookie-domain');
        store.set('cookieDomain', 'example.com');
      });
      await store.persist({ key: 'value' });

      expect(cookieService.write).to.have.been.calledWith(
        'session-cookie-domain',
        JSON.stringify({ key: 'value' }),
        { domain: 'example.com', expires: null, path: '/', sameSite: null, secure: false }
      );
    });

    it('respects the configured cookiePath', async function() {
      run(() => {
        store.set('cookieName', 'session-cookie-domain');
        store.set('cookieDomain', 'example.com');
        store.set('cookiePath', '/hello-world');
      });
      let cookieService = store.get('_cookies');
      await store.persist({ key: 'value' });

      expect(cookieService.write).to.have.been.calledWith(
        'session-cookie-domain',
        JSON.stringify({ key: 'value' }),
        { domain: 'example.com', expires: null, path: '/hello-world', sameSite: null, secure: false }
      );
    });

    it('respects the configured sameSite', async function() {
      run(() => {
        store.set('cookieName', 'session-cookie-domain');
        store.set('cookieDomain', 'example.com');
        store.set('sameSite', 'Strict');
      });
      let cookieService = store.get('_cookies');
      await store.persist({ key: 'value' });
      expect(cookieService.write).to.have.been.calledWith(
        'session-cookie-domain',
        JSON.stringify({ key: 'value' }),
        { domain: 'example.com', expires: null, path: '/', sameSite: 'Strict', secure: false }
      );
    });

    it('sends a warning when `cookieExpirationTime` is less than 90 seconds', async function(done) {
      run(() => {
        store.set('cookieName', 'session-cookie-domain');
        store.set('cookieDomain', 'example.com');
        store.set('cookieExpirationTime', 60);
      });
      await store.persist({ key: 'value' });
      run(() => {
        expect(warnings).to.have.length(1);
        expect(warnings[0]).to.equal('The recommended minimum value for `cookieExpirationTime` is 90 seconds. If your value is less than that, the cookie may expire before its expiration time is extended (expiration time is extended every 60 seconds).');

        done();
      });
    });
  });

  describe('#renew', function() {
    let now = new Date();
    let cookieService;
    let store;

    beforeEach(async function() {
      store = options.store(sinon, this.owner, {
        cookieName: 'test-session',
        cookieExpirationTime: 60,
      });
      cookieService = store.get('_cookies');
      await store.persist({ key: 'value' });
      await renew(store);
    });

    it('stores the expiration time in a cookie named "test-session-expiration_time"', function() {
      expect(cookieService.write).to.have.been.calledWith(
        'test-session-expiration_time',
        60,
        sinon.match(function({ domain, expires, path, secure }) {
          return domain === null &&
            path === '/' &&
            secure === false && expires >= new Date(now.getTime() + 60 * 1000);
        })
      );
    });
  });

  describe('the "sessionDataUpdated" event', function() {
    let triggered;
    let store;

    beforeEach(async function() {
      store = options.store(sinon, this.owner, {
        cookieName: 'ember_simple_auth-session',
      });
      triggered = false;
      store.one('sessionDataUpdated', () => {
        triggered = true;
      });
      await store.persist({ key: 'value' });
    });

    it('is not triggered when the cookie has not actually changed', function(done) {
      document.cookie = 'ember_simple_auth-session=%7B%22key%22%3A%22value%22%7D;path=/;';
      sync(store);

      next(() => {
        expect(triggered).to.be.false;
        done();
      });
    });

    it('is triggered when the cookie changed', function(done) {
      const cookiesService = store.get('_cookies') || store.get('_store._cookies');
      cookiesService._content['ember_simple_auth-session'] = '%7B%22key%22%3A%22other%20value%22%7D';
      sync(store);

      next(() => {
        next(() => {
          expect(triggered).to.be.true;
          done();
        });
      });
    });

    it('is not triggered when the cookie expiration was renewed', function(done) {
      renew(store, { key: 'value' });
      sync(store);

      next(() => {
        expect(triggered).to.be.false;
        done();
      });
    });
  });

  describe('rewrite behavior', function() {
    let store;
    let cookieSpy;
    let cookieService;
    let now = new Date();

    beforeEach(function() {
      cookieService = FakeCookieService.create();
      store = options.store(sinon, this.owner, {
        _cookieName: 'session-foo',
        _cookieExpirationTime: 1000
      });
      cookieService = store.get('_cookies') || store.get('_store._cookies');
      cookieSpy = spyRewriteCookieMethod(sinon, store);
      sinon.spy(cookieService, 'clear');
    });

    afterEach(function() {
      cookieService.write.restore();
      cookieService.clear.restore();
      cookieSpy.restore();
    });

    it('deletes the old cookie and writes a new one when name property changes', async function() {
      run(() => {
        store.set('cookieName', 'session-bar');
      });
      await store.persist({ key: 'value' });

      expect(cookieService.clear).to.have.been.calledWith('session-foo');

      expect(cookieService.clear).to.have.been.calledWith('session-foo-expiration_time');

      expect(cookieService.write).to.have.been.calledWith(
        'session-bar',
        JSON.stringify({ key: 'value' }),
        sinon.match(function({ domain, expires, path, secure }) {
          return domain === null &&
            path === '/' &&
            secure === false &&
            expires >= new Date(now.getTime() + 1000 * 1000);
        })
      );

      expect(cookieService.write).to.have.been.calledWith(
        'session-bar-expiration_time',
        1000,
        sinon.match(function({ domain, expires, path, secure }) {
          return domain === null &&
            path === '/' &&
            secure === false &&
            expires >= new Date(now.getTime() + 1000 * 1000);
        })
      );
    });

    it('deletes the old cookie and writes a new one when domain property changes', async function() {
      let defaultName = 'session-foo';
      run(() => {
        store.set('cookieDomain', 'example.com');
        store.set('cookieName', 'session-bar');
      });
      await store.persist({ key: 'value' });

      expect(cookieService.clear).to.have.been.calledWith(defaultName);

      expect(cookieService.clear).to.have.been.calledWith(`${defaultName}-expiration_time`);

      expect(cookieService.write).to.have.been.calledWith(
        'session-bar',
        JSON.stringify({ key: 'value' }),
        sinon.match(function({ domain, expires, path, secure }) {
          return domain === 'example.com' &&
            path === '/' &&
            secure === false &&
            expires >= new Date(now.getTime() + 1000 * 1000);
        })
      );
    });

    it('deletes the old cookie and writes a new one when expiration property changes', async function() {
      let defaultName = 'session-foo';
      let expirationTime = 180;
      run(() => {
        store.set('cookieExpirationTime', expirationTime);
        store.set('cookieName', 'session-bar');
      });
      await store.persist({ key: 'value' });

      expect(cookieService.clear).to.have.been.calledWith(defaultName);

      expect(cookieService.clear).to.have.been.calledWith(`${defaultName}-expiration_time`);

      expect(cookieService.write).to.have.been.calledWith(
        'session-bar',
        JSON.stringify({ key: 'value' }),
        sinon.match(function({ domain, expires, path, secure }) {
          return domain === null &&
            path === '/' &&
            secure === false &&
            expires >= new Date(now.getTime() + (expirationTime - 10) * 1000);
        })
      );
    });

    // eslint-disable-next-line require-await
    it('clears cached expiration times when setting expiration to null', async function() {
      run(() => {
        store.set('cookieExpirationTime', null);
      });

      expect(cookieService.clear).to.have.been.calledWith(`session-foo-expiration_time`);
    });

    it('only rewrites the cookie once per run loop when multiple properties are changed', function(done) {
      run(() => {
        store.set('cookieName', 'session-bar');
        store.set('cookieExpirationTime', 10000);
      });

      next(() => {
        expect(cookieSpy).to.have.been.calledOnce;
        done();
      });
    });
  });

  describe('#init', function() {
    let store;
    let cookieService;
    let cookieName = 'ember_simple_auth-session-expiration_time';
    let expirationTime = 60 * 60 * 24;

    beforeEach(function() {
      store = options.store(sinon, this.owner, {
        cookieExpirationTime: expirationTime,
      });
      cookieService = store.get('_cookies');
      cookieService.write(cookieName, expirationTime);
    });

    // eslint-disable-next-line require-await
    it('restores expiration time from cookie', async function() {
      expect(store.get('cookieExpirationTime')).to.equal(expirationTime);
    });
  });
}
