import Ember from 'ember';
import InternalSession from '../internal-session';
import Ephemeral from '../session-stores/ephemeral';

export default function setupSession(registry) {
  registry.register('session:main', InternalSession);

  if (Ember.testing) {
    registry.register('session-store:test', Ephemeral);
  }
}
