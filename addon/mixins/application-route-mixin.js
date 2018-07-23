import Mixin from '@ember/object/mixin';
import { A } from '@ember/array';
import { computed } from '@ember/object';
import { getOwner } from '@ember/application';
import { inject } from '@ember/service';
import Ember from 'ember';
import Configuration from './../configuration';
import { assert } from '@ember/debug';
import location from 'ember-simple-auth/utils/location';
/**
 * Standard after-session-validation logic
 * @param {Ember.Route | Ember.Router} rou A container-aware ember object with a transitionTo() function
 * @param {string} routeAfterAuthentication Route to redirect the user to, if no previous transition information is found
 */
export function sessionAuthenticatedHandler(rou, routeAfterAuthentication) {
  assert('sessionAuthenticatedHandler must be passed a router', rou);
  const container = getOwner(rou);
  const session = container.lookup('service:session');
  const attemptedTransition = session.get('attemptedTransition');
  const cookies = container.lookup('service:cookies');
  const redirectTarget = cookies.read('ember_simple_auth-redirectTarget');

  if (attemptedTransition) {
    attemptedTransition.retry();
    session.set('attemptedTransition', null);
  } else if (redirectTarget) {
    rou.transitionTo(redirectTarget);
    cookies.clear('ember_simple_auth-redirectTarget');
  } else {
    rou.transitionTo(routeAfterAuthentication);
  }
}

/**
 * Standard after-session-rejected logic
 * @param {Ember.Route | Ember.Router} rou A container-aware ember object with a transitionTo() function
 */
export function sessionInvalidatedHandler(rou) {
  assert('sessionInvalidatedHandler must be passed a router', rou);
  if (!Ember.testing) {
    // TODO: replace with use of single isFastBoot fn
    const fastboot = getOwner(this).lookup('service:fastboot');
    const isFastBoot = fastboot ? fastboot.get('isFastBoot') : false;
    if (isFastBoot) {
      rou.transitionTo(Configuration.rootURL);
    } else {
      location().replace(Configuration.rootURL);
    }
  }
}

/**
  The mixin for the application route, __defining methods that are called when
  the session is successfully authenticated (see
  {{#crossLink "SessionService/authenticationSucceeded:event"}}{{/crossLink}})
  or invalidated__ (see
  {{#crossLink "SessionService/invalidationSucceeded:event"}}{{/crossLink}}).

  __Using this mixin is optional.__ The session events can also be handled
  manually, e.g. in an instance initializer:

  ```js
  // app/instance-initializers/session-events.js
  export function initialize(instance) {
    const applicationRoute = instance.container.lookup('route:application');
    const session          = instance.container.lookup('service:session');
    session.on('authenticationSucceeded', function() {
      applicationRoute.transitionTo('index');
    });
    session.on('invalidationSucceeded', function() {
      applicationRoute.transitionTo('bye');
    });
  };

  export default {
    initialize,
    name:  'session-events',
    after: 'ember-simple-auth'
  };
  ```

  __When using the `ApplicationRouteMixin` you need to specify
  `needs: ['service:session']` in the application route's unit test.__

  @class ApplicationRouteMixin
  @module ember-simple-auth/mixins/application-route-mixin
  @extends Ember.Mixin
  @public
*/
export default Mixin.create({
  /**
    The session service.

    @property session
    @readOnly
    @type SessionService
    @public
  */
  session: inject('session'),

  _isFastBoot: computed(function() {
    const fastboot = getOwner(this).lookup('service:fastboot');

    return fastboot ? fastboot.get('isFastBoot') : false;
  }),

  /**
    The route to transition to after successful authentication.

    @property routeAfterAuthentication
    @type String
    @default 'index'
    @public
  */
  routeAfterAuthentication: computed(function() {
    return Configuration.routeAfterAuthentication;
  }),

  init() {
    this._super(...arguments);
    this._subscribeToSessionEvents();
  },

  _subscribeToSessionEvents() {
    A([
      ['authenticationSucceeded', 'sessionAuthenticated'],
      ['invalidationSucceeded', 'sessionInvalidated']
    ]).forEach(([event, method]) => {
      this.get('session').on(event, (...args) => this[method](...args));
    });
  },

  /**
    This method handles the session's
    {{#crossLink "SessionService/authenticationSucceeded:event"}}{{/crossLink}}
    event. If there is a transition that was previously intercepted by the
    {{#crossLink "AuthenticatedRouteMixin/beforeModel:method"}}
    AuthenticatedRouteMixin's `beforeModel` method{{/crossLink}} it will retry
    it. If there is no such transition, the `ember_simple_auth-redirectTarget`
    cookie will be checked for a url that represents an attemptedTransition
    that was aborted in Fastboot mode, otherwise this action transitions to the
    {{#crossLink "Configuration/routeAfterAuthentication:property"}}{{/crossLink}}.


    @method sessionAuthenticated
    @public
  */
  sessionAuthenticated() {
    sessionAuthenticatedHandler(
      this,
      this.get('routeAfterAuthentication'));
  },

  /**
    This method handles the session's
    {{#crossLink "SessionService/invalidationSucceeded:event"}}{{/crossLink}}
    event. __It reloads the Ember.js application__ by redirecting the browser
    to the application's root URL so that all in-memory data (such as Ember
    Data stores etc.) gets cleared.

    If the Ember.js application will be used in an environment where the users
    don't have direct access to any data stored on the client (e.g.
    [cordova](http://cordova.apache.org)) this action can be overridden to e.g.
    simply transition to the index route.

    @method sessionInvalidated
    @public
  */
  sessionInvalidated() {
    sessionInvalidatedHandler(this);
  }
});
