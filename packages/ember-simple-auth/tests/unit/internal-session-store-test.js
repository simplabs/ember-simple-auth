import Ember from 'ember';
import { describe, beforeEach, it } from 'mocha';
import { setupApplicationTest } from 'ember-mocha';
import { expect } from 'chai';
import sinonjs from 'sinon';

describe('InternalSession store injection', () => {
  setupApplicationTest();

  let sinon;
  let session;

  beforeEach(function() {
    sinon = sinonjs.createSandbox();
  });

  afterEach(function() {
    sinon.restore();
  });

  describe('session store injection', function() {
    afterEach(function() {
      Ember.testing = true; // eslint-disable-line ember/no-ember-testing-in-module-scope
    });

    it('looks up the test session store when Ember.testing true', function() {
      Ember.testing = true; // eslint-disable-line ember/no-ember-testing-in-module-scope

      session = this.owner.lookup('session:main');
      expect(session.get('store')).to.eql(this.owner.lookup('session-store:test'));
    });

    it('looks up the application session store when Ember.testing false', function() {
      Ember.testing = false; // eslint-disable-line ember/no-ember-testing-in-module-scope

      session = this.owner.lookup('session:main');
      expect(session.get('store')).to.eql(this.owner.lookup('session-store:application'));
    });
  });
});
