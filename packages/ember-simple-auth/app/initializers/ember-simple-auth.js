import ENV from '../config/environment';
import Configuration from 'ember-simple-auth/configuration';
import setupSession from 'ember-simple-auth/initializers/setup-session';
import setupSessionService from 'ember-simple-auth/initializers/setup-session-service';
import setupSessionRestoration from 'ember-simple-auth/initializers/setup-session-restoration';
import Adaptive from 'ember-simple-auth/session-stores/adaptive';
import LocalStorage from 'ember-simple-auth/session-stores/local-storage';
import Cookie from 'ember-simple-auth/session-stores/cookie';

export default {
  name: 'ember-simple-auth',

  initialize(registry) {
    const config = ENV['ember-simple-auth'] || {};
    config.rootURL = ENV.rootURL || ENV.baseURL;
    Configuration.load(config);

    registry.register('session-store:adaptive', Adaptive);
    registry.register('session-store:cookie', Cookie);
    registry.register('session-store:local-storage', LocalStorage);

    setupSession(registry);
    setupSessionService(registry);
    setupSessionRestoration(registry);
  }
};
