import { run } from '@ember/runloop';
import { describe, beforeEach, it } from 'mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';

export default function(options) {
  let sinon;
  let store;

  // eslint-disable-next-line mocha/no-top-level-hooks
  beforeEach(function() {
    sinon = sinonjs.createSandbox();
  });

  // eslint-disable-next-line mocha/no-top-level-hooks
  afterEach(function() {
    sinon.restore();
  });

  describe('storage events', function() {
    beforeEach(function() {
      sinon.spy(window, 'addEventListener');
      sinon.spy(window, 'removeEventListener');
    });

    afterEach(function() {
      window.addEventListener.restore();
      window.removeEventListener.restore();
    });

    it('binds to "storage" events on the window when created', function() {
      store = options.store(this);

      expect(window.addEventListener).to.have.been.calledOnce;
    });

    it('triggers the "sessionDataUpdated" event when the data in the browser storage has changed', function() {
      store = options.store(this);
      let triggered = false;
      store.on('sessionDataUpdated', () => {
        triggered = true;
      });

      window.dispatchEvent(new StorageEvent('storage', { key: store.get('key') }));

      expect(triggered).to.be.true;
    });

    it('does not trigger the "sessionDataUpdated" event when the data in the browser storage has not changed', function() {
      store = options.store(this);
      let triggered = false;
      store.on('sessionDataUpdated', () => {
        triggered = true;
      });

      store.persist({ key: 'value' }); // this data will be read again when the event is handled so that no change will be detected
      window.dispatchEvent(new StorageEvent('storage', { key: store.get('key') }));

      expect(triggered).to.be.false;
    });

    it('does not trigger the "sessionDataUpdated" event when the data in the browser storage has changed for a different key', function() {
      store = options.store(this);
      let triggered = false;
      store.on('sessionDataUpdated', () => {
        triggered = true;
      });

      window.dispatchEvent(new StorageEvent('storage', { key: 'another key' }));

      expect(triggered).to.be.false;
    });

    it('unbinds from "storage" events on the window when destroyed', function() {
      store = options.store(this);
      run(() => store.destroy());

      expect(window.removeEventListener).to.have.been.calledOnce;
    });
  });
}
