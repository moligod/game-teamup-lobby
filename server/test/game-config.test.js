const test = require('node:test');
const assert = require('node:assert/strict');
const { configuredTeamTypes } = require('../src/infrastructure/persistence/postgres/database');
test('new installations use general team types and accept bounded game-specific configuration', () => {
  assert.deepEqual(configuredTeamTypes('').map(x => x.id), ['casual', 'competitive', 'cooperative']);
  assert.deepEqual(configuredTeamTypes('[{"id":"raid","zh":"副本","en":"Raid"}]').map(x => x.id), ['raid']);
  assert.throws(() => configuredTeamTypes('not json'), /JSON array/);
  assert.throws(() => configuredTeamTypes('[{"id":"raid","zh":"a","en":"b"},{"id":"raid","zh":"a","en":"b"}]'), /unique/);
});
