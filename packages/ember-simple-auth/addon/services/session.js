import { alias, oneWay } from '@ember/object/computed';
import { A } from '@ember/array';
import Service from '@ember/service';
import Evented from '@ember/object/evented';
import { getOwner } from '@ember/application';
import { assert } from '@ember/debug';
import { deprecate } from '@ember/application/deprecations';
import Configuration from '../configuration';

import {
  requireAuthentication,
  triggerAuthentication,
  prohibitAuthentication,
  handleSessionAuthenticated,
  handleSessionInvalidated
} from '../-internals/routing';

const SESSION_DATA_KEY_PREFIX = /^data\./;

let enableEventsDeprecation = true;
function deprecateSessionEvents() {
  if (enableEventsDeprecation) {
    deprecate("Ember Simple Auth: The session service's events API is deprecated; to add custom behavior to the authentication or invalidation handling, override the handleAuthentication or handleInvalidation methods.", false, {
      id: 'ember-simple-auth.events.session-service',
      until: '4.0.0'
    });
  }
}

/**
  __The session service provides access to the current session as well as
  methods to authenticate it, invalidate it, etc.__ It is the main interface for
  the application to Ember Simple Auth's functionality. It can be injected via

  ```js
  // app/components/login-form.js
  import Component from '@ember/component';
  import { inject as service } from '@ember/service';

  export default class LoginFormComponent extends Component {
    @service session;
  }
  ```

  @class SessionService
  @module ember-simple-auth/services/session
  @extends Ember.Service
  @uses Ember.Evented
  @public
*/
export default Service.extend(Evented, {
  /**
    Triggered whenever the session is successfully authenticated. This happens
    when the session gets authenticated via
    {{#crossLink "SessionService/authenticate:method"}}{{/crossLink}} but also
    when the session is authenticated in another tab or window of the same
    application and the session state gets synchronized across tabs or windows
    via the store (see
    {{#crossLink "BaseStore/sessionDataUpdated:event"}}{{/crossLink}}).

    When using the {{#crossLink "ApplicationRouteMixin"}}{{/crossLink}} this
    event will automatically get handled (see
    {{#crossLink "ApplicationRouteMixin/sessionAuthenticated:method"}}{{/crossLink}}).

    @event authenticationSucceeded
    @public
  */

  /**
    Triggered whenever the session is successfully invalidated. This happens
    when the session gets invalidated via
    {{#crossLink "SessionService/invalidate:method"}}{{/crossLink}} but also
    when the session is invalidated in another tab or window of the same
    application and the session state gets synchronized across tabs or windows
    via the store (see
    {{#crossLink "BaseStore/sessionDataUpdated:event"}}{{/crossLink}}).

    When using the {{#crossLink "ApplicationRouteMixin"}}{{/crossLink}} this
    event will automatically get handled (see
    {{#crossLink "ApplicationRouteMixin/sessionInvalidated:method"}}{{/crossLink}}).

    @event invalidationSucceeded
    @public
  */

  /**
    Returns whether the session is currently authenticated.

    @property isAuthenticated
    @type Boolean
    @readOnly
    @default false
    @public
  */
  isAuthenticated: oneWay('session.isAuthenticated'),

  /**
    The current session data as a plain object. The
    `authenticated` key holds the session data that the authenticator resolved
    with when the session was authenticated (see
    {{#crossLink "BaseAuthenticator/authenticate:method"}}{{/crossLink}}) and
    that will be cleared when the session is invalidated. This data cannot be
    written. All other session data is writable and will not be cleared when
    the session is invalidated.

    @property data
    @type Object
    @readOnly
    @default { authenticated: {} }
    @public
  */
  data: oneWay('session.content'),

  /**
    The session store.

    @property store
    @type BaseStore
    @readOnly
    @default null
    @public
  */
  store: oneWay('session.store'),

  /**
    A previously attempted but intercepted transition (e.g. by the
    {{#crossLink "AuthenticatedRouteMixin"}}{{/crossLink}}). If an attempted
    transition is present, the
    {{#crossLink "ApplicationRouteMixin"}}{{/crossLink}} will retry it when the
    session becomes authenticated (see
    {{#crossLink "ApplicationRouteMixin/sessionAuthenticated:method"}}{{/crossLink}}).

    @property attemptedTransition
    @type Transition
    @default null
    @public
  */
  attemptedTransition: alias('session.attemptedTransition'),

  session: null,

  init() {
    this._super(...arguments);
    this.set('session', getOwner(this).lookup('session:main'));
    this._forwardSessionEvents();
  },

  set(key, value) {
    const setsSessionData = SESSION_DATA_KEY_PREFIX.test(key);
    if (setsSessionData) {
      const sessionDataKey = `session.${key.replace(SESSION_DATA_KEY_PREFIX, '')}`;
      return this._super(sessionDataKey, value);
    } else {
      return this._super(...arguments);
    }
  },

  _forwardSessionEvents() {
    A([
      'authenticationSucceeded',
      'invalidationSucceeded'
    ]).forEach((event) => {
      const session = this.get('session');
      // the internal session won't be available in route unit tests
      if (session) {
        session.on(event, () => {
          enableEventsDeprecation = false;
          this.trigger(event, ...arguments);
          enableEventsDeprecation = true;
        });
      }
    });
  },

  on() {
    deprecateSessionEvents();

    return this._super(...arguments);
  },

  one() {
    deprecateSessionEvents();

    return this._super(...arguments);
  },

  off() {
    deprecateSessionEvents();

    return this._super(...arguments);
  },

  has() {
    deprecateSessionEvents();

    return this._super(...arguments);
  },

  trigger() {
    deprecateSessionEvents();

    return this._super(...arguments);
  },

  _setupHandlers() {
    this.get('session').on('authenticationSucceeded', () => this.handleAuthentication(Configuration.routeAfterAuthentication));
    this.get('session').on('invalidationSucceeded', () => this.handleInvalidation(Configuration.rootURL));
  },

  /**
    __Authenticates the session with an `authenticator`__ and appropriate
    arguments. The authenticator implements the actual steps necessary to
    authenticate the session (see
    {{#crossLink "BaseAuthenticator/authenticate:method"}}{{/crossLink}}) and
    returns a promise after doing so. The session handles the returned promise
    and when it resolves becomes authenticated, otherwise remains
    unauthenticated. All data the authenticator resolves with will be
    accessible via the
    {{#crossLink "SessionService/data:property"}}session data's{{/crossLink}}
    `authenticated` property.

    __This method returns a promise. A resolving promise indicates that the
    session was successfully authenticated__ while a rejecting promise
    indicates that authentication failed and the session remains
    unauthenticated. The promise does not resolve with a value; instead, the
    data returned from the authenticator is available via the
    {{#crossLink "SessionService/data:property"}}{{/crossLink}} property.

    When authentication succeeds this will trigger the
    {{#crossLink "SessionService/authenticationSucceeded:event"}}{{/crossLink}}
    event.

    @method authenticate
    @param {String} authenticator The authenticator to use to authenticate the session
    @param {Any} [...args] The arguments to pass to the authenticator; depending on the type of authenticator these might be a set of credentials, a Facebook OAuth Token, etc.
    @return {Ember.RSVP.Promise} A promise that resolves when the session was authenticated successfully and rejects otherwise
    @public
  */
  authenticate() {
    const session = this.get('session');

    return session.authenticate(...arguments);
  },

  /**
    __Invalidates the session with the authenticator it is currently
    authenticated with__ (see
    {{#crossLink "SessionService/authenticate:method"}}{{/crossLink}}). This
    invokes the authenticator's
    {{#crossLink "BaseAuthenticator/invalidate:method"}}{{/crossLink}} method
    and handles the returned promise accordingly.

    This method returns a promise. A resolving promise indicates that the
    session was successfully invalidated while a rejecting promise indicates
    that invalidation failed and the session remains authenticated. Once the
    session is successfully invalidated it clears all of its authenticated data
    (see {{#crossLink "SessionService/data:property"}}{{/crossLink}}).

    When invalidation succeeds this will trigger the
    {{#crossLink "SessionService/invalidationSucceeded:event"}}{{/crossLink}}
    event.

    When calling the {{#crossLink "BaseAuthenticator/invalidate:method"}}{{/crossLink}}
    on an already unauthenticated session, the method will return a resolved Promise
    immediately.

    @method invalidate
    @param {Array} ...args arguments that will be passed to the authenticator
    @return {Ember.RSVP.Promise} A promise that resolves when the session was invalidated successfully and rejects otherwise
    @public
  */
  invalidate() {
    const session = this.get('session');

    return session.invalidate(...arguments);
  },

  /**
    Checks whether the session is authenticated and if it is not, transitions
    to the specified route or invokes the specified callback.

    If a transition is in progress and is aborted, this method will save it in the
    session service's
    {{#crossLink "SessionService/attemptedTransition:property"}}{{/crossLink}}
    property so that  it can be retried after the session is authenticated. If
    the transition is aborted in Fastboot mode, the transition's target URL
    will be saved in a `ember_simple_auth-redirectTarget` cookie for use by the
    browser after authentication is complete.

    @method requireAuthentication
    @param {Transition} transition A transition that triggered the authentication requirement or null if the requirement originated independently of a transition
    @param {String|Function} routeOrCallback The route to transition to in case that the session is not authenticated or a callback function to invoke in that case
    @return {Boolean} true when the session is authenticated, false otherwise
    @public
  */
  requireAuthentication(transition, routeOrCallback) {
    let isAuthenticated = requireAuthentication(getOwner(this), transition);
    if (!isAuthenticated) {
      let argType = typeof routeOrCallback;
      if (argType === 'string') {
        triggerAuthentication(getOwner(this), routeOrCallback);
      } else if (argType === 'function') {
        routeOrCallback();
      } else {
        assert(`The second argument to requireAuthentication must be a String or Function, got "${argType}"!`, false);
      }
    }
    return isAuthenticated;
  },

  /**
    Checks whether the session is authenticated and if it is, transitions
    to the specified route or invokes the specified callback.

    @method prohibitAuthentication
    @param {String|Function} routeOrCallback The route to transition to in case that the session is authenticated or a callback function to invoke in that case
    @return {Boolean} true when the session is not authenticated, false otherwise
    @public
  */
  prohibitAuthentication(routeOrCallback) {
    let isAuthenticated = this.get('isAuthenticated');
    if (isAuthenticated) {
      let argType = typeof routeOrCallback;
      if (argType === 'string') {
        prohibitAuthentication(getOwner(this), routeOrCallback);
      } else if (argType === 'function') {
        routeOrCallback();
      } else {
        assert(`The first argument to prohibitAuthentication must be a String or Function, got "${argType}"!`, false);
      }
    }
    return !isAuthenticated;
  },

  /**
    This method is called whenever the session goes from being unauthenticated
    to being authenticated. If there is a transition that was previously
    intercepted by the
    {{#crossLink "SessionService/requireAuthentication:method"}}{{/crossLink}},
    it will retry it. If there is no such transition, the
    `ember_simple_auth-redirectTarget` cookie will be checked for a url that
    represents an attemptedTransition that was aborted in Fastboot mode,
    otherwise this action transitions to the specified
    routeAfterAuthentication.

    @method handleAuthentication
    @param {String} routeAfterAuthentication The route to transition to
    @public
  */
  handleAuthentication(routeAfterAuthentication) {
    handleSessionAuthenticated(getOwner(this), routeAfterAuthentication);
  },

  /**
    This method is called whenever the session goes from being authenticated to
    not being authenticated. __It reloads the Ember.js application__ by
    redirecting the browser to the specified route so that all in-memory data
    (such as Ember Data stores etc.) gets cleared.

    If the Ember.js application will be used in an environment where the users
    don't have direct access to any data stored on the client (e.g.
    [cordova](http://cordova.apache.org)) this action can be overridden to e.g.
    simply transition to the index route.

    @method handleInvalidation
    @param {String} routeAfterInvalidation The route to transition to
    @public
  */
  handleInvalidation(routeAfterInvalidation) {
    handleSessionInvalidated(getOwner(this), routeAfterInvalidation);
  }
});
