import { next, run } from '@ember/runloop';
import { describe, beforeEach, afterEach, it } from 'mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';

export default function(options) {
  let syncExternalChanges = options.syncExternalChanges || function() {};
  let sinon;

  // eslint-disable-next-line mocha/no-top-level-hooks
  beforeEach(function() {
    sinon = sinonjs.createSandbox();
  });

  // eslint-disable-next-line mocha/no-top-level-hooks
  afterEach(function() {
    sinon.restore();
  });

  describe('#persist', function() {
    let store;
    beforeEach(function() {
      store = options.store(sinon, this.owner);
    });

    it('persists an object', async function() {
      await store.persist({ key: 'value' });
      let restoredContent = await store.restore();

      expect(restoredContent).to.eql({ key: 'value' });
    });

    it('overrides existing data', async function() {
      await store.persist({ key: 'value' });
      await store.persist({ key1: 'value1' });
      await store.persist({ key2: 'value2' });
      let restoredContent = await store.restore();

      expect(restoredContent).to.eql({ key2: 'value2' });
    });

    it('does not trigger the "sessionDataUpdated" event', function(done) {
      let triggered = false;
      store.one('sessionDataUpdated', () => (triggered = true));
      store.persist({ key: 'other value' });
      syncExternalChanges(store);

      next(() => {
        expect(triggered).to.be.false;
        done();
      });
    });
  });

  describe('#restore', function() {
    describe('when the store is empty', function() {
      it('returns an empty object', async function() {
        let store;
        run(() => {
          store = options.store(sinon, this.owner);
        });
        await store.clear();
        let restoredContent = await store.restore();

        expect(restoredContent).to.eql({});
      });
    });

    describe('when the store has data', function() {
      let store;
      beforeEach(function() {
        store = options.store(sinon, this.owner);
        return store.persist({ key1: 'value1', key2: 'value2' });
      });

      it('returns all data in the store', async function() {
        let restoredContent = await store.restore();

        expect(restoredContent).to.eql({ key1: 'value1', key2: 'value2' });
      });

      it('returns a copy of the stored data', async function() {
        let data = await store.restore();
        data.key1 = 'another value!';
        let restoredContent = await store.restore();

        expect(restoredContent).to.eql({ key1: 'value1', key2: 'value2' });
      });
    });
  });

  describe('#clear', function() {
    it('empties the store', async function() {
      let store;
      run(() => {
        store = options.store(sinon, this.owner);
      });
      await store.persist({ key1: 'value1', key2: 'value2' });
      await store.clear();
      let restoredContent = await store.restore();

      expect(restoredContent).to.eql({});
    });
  });
}
