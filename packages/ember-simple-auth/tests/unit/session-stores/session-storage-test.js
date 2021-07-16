import { describe } from 'mocha';
import SessionStorage from 'ember-simple-auth/session-stores/session-storage';
import itBehavesLikeAStore from './shared/store-behavior';
import itBehavesLikeAStorageEventHandler from './shared/storage-event-handler-behavior';
import { setupTest } from 'ember-mocha';

describe('SessionStorageStore', function() {
  setupTest();

  describe('StoreBehavior', function() {
    itBehavesLikeAStore({
      store(context) {
        context.owner.register('session:main', SessionStorage.extend({
          _isFastBoot: false
        }));

        return context.owner.lookup('session:main');
      }
    });
  });

  describe('StoreEventHandlers', function() {
    itBehavesLikeAStorageEventHandler({
      store(context) {
        context.owner.register('session:main', SessionStorage.extend({
          _isFastBoot: false
        }));

        return context.owner.lookup('session:main');
      }
    });
  });
});
