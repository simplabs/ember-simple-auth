import ENV from '../config/environment';
import Configuration from 'ember-simple-auth/configuration';
import setupSession from 'ember-simple-auth/initializers/setup-session';
import setupSessionRestoration from 'ember-simple-auth/initializers/setup-session-restoration';

export default {
  name: 'ember-simple-auth',

  initialize(registry) {
    const config = ENV['ember-simple-auth'] || {};
    config.rootURL = ENV.rootURL || ENV.baseURL;
    Configuration.load(config);

    setupSession(registry);
    setupSessionRestoration(registry);
  }
};
