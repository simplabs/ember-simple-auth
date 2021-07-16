import { describe } from 'mocha';
import LocalStorage from 'ember-simple-auth/session-stores/local-storage';
import itBehavesLikeAStore from './shared/store-behavior';
import itBehavesLikeAStorageEventHandler from './shared/storage-event-handler-behavior';
import { setupTest } from 'ember-mocha';

describe('LocalStorageStore', function() {
  setupTest();

  describe('StoreBehavior', function() {
    itBehavesLikeAStore({
      store(context) {
        context.owner.register('session:main', LocalStorage.extend({
          _isFastBoot: false
        }));

        return context.owner.lookup('session:main');
      }
    });
  });

  describe('StoreEventHandlers', function() {
    itBehavesLikeAStorageEventHandler({
      store(context) {
        context.owner.register('session:main', LocalStorage.extend({
          _isFastBoot: false
        }));

        return context.owner.lookup('session:main');
      }
    });
  });
});
