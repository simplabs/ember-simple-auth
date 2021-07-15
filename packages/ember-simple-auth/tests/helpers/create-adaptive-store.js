import Adaptive from 'ember-simple-auth/session-stores/adaptive';

export default function createAdaptiveStore(
  cookiesService,
  options = {},
  owner
) {
  owner.register('session-store:adaptive', Adaptive.extend(Object.assign({
    _isLocalStorageAvailable: false,
  }, options)));

  return owner.lookup('session-store:adaptive');
}
