import Ember from 'ember';
import RSVP from 'rsvp';
import { isEmpty, isNone } from '@ember/utils';
import ObjectProxy from '@ember/object/proxy';
import Evented from '@ember/object/evented';
import { merge, assign as emberAssign } from '@ember/polyfills';
import { set } from '@ember/object';
import { debug, assert } from '@ember/debug';
import { getOwner, setOwner } from '@ember/application';
const assign = emberAssign || merge;

export default ObjectProxy.extend(Evented, {
  authenticator:       null,
  store:               null,
  isAuthenticated:     false,
  attemptedTransition: null,

  init() {
    this._super(...arguments);
    let storeFactory = 'session-store:application';
    if (Ember.testing) {
      storeFactory = 'session-store:test';
    }

    this.set('store', getOwner(this).lookup(storeFactory));
    this.set('content', { authenticated: {} });
    this._busy = false;
    this._bindToStoreEvents();
  },

  authenticate(authenticatorFactory, ...args) {
    this._busy = true;
    assert(`Session#authenticate requires the authenticator to be specified, was "${authenticatorFactory}"!`, !isEmpty(authenticatorFactory));
    const authenticator = this._lookupAuthenticator(authenticatorFactory);
    assert(`No authenticator for factory "${authenticatorFactory}" could be found!`, !isNone(authenticator));

    return authenticator.authenticate(...args).then((content) => {
      this._busy = false;
      return this._setup(authenticatorFactory, content, true);
    }, (error) => {
      const rejectWithError = () => RSVP.Promise.reject(error);

      this._busy = false;
      return this._clear().then(rejectWithError, rejectWithError);
    });
  },

  invalidate() {
    this._busy = true;
    this.set('attemptedTransition', null);

    if (!this.get('isAuthenticated')) {
      this._busy = false;
      return RSVP.Promise.resolve();
    }

    let authenticator = this._lookupAuthenticator(this.authenticator);
    return authenticator.invalidate(this.content.authenticated, ...arguments).then(() => {
      authenticator.off('sessionDataUpdated', this, this._onSessionDataUpdated);
      this._busy = false;
      return this._clear(true);
    }, (error) => {
      this.trigger('sessionInvalidationFailed', error);
      this._busy = false;
      return RSVP.Promise.reject(error);
    });
  },

  restore() {
    this._busy = true;
    const reject = () => RSVP.Promise.reject();

    return this.store.restore().then((restoredContent) => {
      let { authenticator: authenticatorFactory } = restoredContent.authenticated || {};
      if (authenticatorFactory) {
        delete restoredContent.authenticated.authenticator;
        const authenticator = this._lookupAuthenticator(authenticatorFactory);
        return authenticator.restore(restoredContent.authenticated).then((content) => {
          this.set('content', restoredContent);
          this._busy = false;
          return this._setup(authenticatorFactory, content);
        }, (err) => {
          debug(`The authenticator "${authenticatorFactory}" rejected to restore the session - invalidating…`);
          if (err) {
            debug(err);
          }
          this._busy = false;
          return this._clearWithContent(restoredContent).then(reject, reject);
        });
      } else {
        delete (restoredContent || {}).authenticated;
        this._busy = false;
        return this._clearWithContent(restoredContent).then(reject, reject);
      }
    }, () => {
      this._busy = false;
      return this._clear().then(reject, reject);
    });
  },

  _setup(authenticator, authenticatedContent, trigger) {
    trigger = Boolean(trigger) && !this.get('isAuthenticated');
    this.setProperties({
      isAuthenticated: true,
      authenticator,
      'content.authenticated': authenticatedContent
    });
    this._bindToAuthenticatorEvents();

    return this._updateStore()
      .then(() => {
        if (trigger) {
          this.trigger('authenticationSucceeded');
        }
      }, () => {
        this.setProperties({
          isAuthenticated: false,
          authenticator: null,
          'content.authenticated': {}
        });
      });
  },

  _clear(trigger) {
    trigger = Boolean(trigger) && this.get('isAuthenticated');
    this.setProperties({
      isAuthenticated: false,
      authenticator:   null,
      'content.authenticated': {}
    });

    return this._updateStore().then(() => {
      if (trigger) {
        this.trigger('invalidationSucceeded');
      }
    });
  },

  _clearWithContent(content, trigger) {
    this.set('content', content);
    return this._clear(trigger);
  },

  setUnknownProperty(key, value) {
    assert('"authenticated" is a reserved key used by Ember Simple Auth!', key !== 'authenticated');
    let result = this._super(key, value);
    if (!(/^_/).test(key)) {
      this._updateStore();
    }
    return result;
  },

  _updateStore() {
    let data = this.content;
    if (!isEmpty(this.authenticator)) {
      set(data, 'authenticated', assign({ authenticator: this.authenticator }, data.authenticated || {}));
    }
    return this.store.persist(data);
  },

  _bindToAuthenticatorEvents() {
    const authenticator = this._lookupAuthenticator(this.authenticator);
    authenticator.on('sessionDataUpdated', this, this._onSessionDataUpdated);
    authenticator.on('sessionDataInvalidated', this, this._onSessionDataInvalidated);
  },

  _onSessionDataUpdated(content) {
    this._setup(this.authenticator, content);
  },

  _onSessionDataInvalidated() {
    this._clear(true);
  },

  _bindToStoreEvents() {
    this.store.on('sessionDataUpdated', (content) => {
      if (!this._busy) {
        this._busy = true;
        let { authenticator: authenticatorFactory } = (content.authenticated || {});
        if (authenticatorFactory) {
          delete content.authenticated.authenticator;
          const authenticator = this._lookupAuthenticator(authenticatorFactory);
          authenticator.restore(content.authenticated).then((authenticatedContent) => {
            this.set('content', content);
            this._busy = false;
            this._setup(authenticatorFactory, authenticatedContent, true);
          }, (err) => {
            debug(`The authenticator "${authenticatorFactory}" rejected to restore the session - invalidating…`);
            if (err) {
              debug(err);
            }
            this._busy = false;
            this._clearWithContent(content, true);
          });
        } else {
          this._busy = false;
          this._clearWithContent(content, true);
        }
      }
    });
  },

  _lookupAuthenticator(authenticatorName) {
    let owner = getOwner(this);
    let authenticator = owner.lookup(authenticatorName);
    setOwner(authenticator, owner);
    return authenticator;
  }
});
