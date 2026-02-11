const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('UUID type', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_uuid');
    await client.query(
      'CREATE TABLE test_uuid (id INTEGER, uid BUILTIN.UUID)'
    );
  });

  after(async () => {
    await dropTable(client, 'test_uuid');
    await client.close();
  });

  it('round-trip: insert and select UUID string', async () => {
    const uuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    await client.query('INSERT INTO test_uuid (id, uid) VALUES (?, ?)', [1, uuid]);
    const result = await client.query('SELECT uid FROM test_uuid WHERE id = ?', [1]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].uid.toLowerCase(), uuid.toLowerCase());
  });

  it('NULL UUID value', async () => {
    await client.query('INSERT INTO test_uuid (id, uid) VALUES (?, ?)', [2, null]);
    const result = await client.query('SELECT uid FROM test_uuid WHERE id = ?', [2]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].uid, null);
  });

  it('metadata shows UUID type name', async () => {
    const result = await client.query('SELECT uid FROM test_uuid WHERE id = ?', [1]);
    assert.strictEqual(result.fields[0].dataTypeName, 'UUID');
  });

  it('multiple UUID values', async () => {
    const uuids = [
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      '550e8400-e29b-41d4-a716-446655440000',
    ];
    for (let i = 0; i < uuids.length; i++) {
      await client.query('INSERT INTO test_uuid (id, uid) VALUES (?, ?)', [10 + i, uuids[i]]);
    }
    for (let i = 0; i < uuids.length; i++) {
      const result = await client.query('SELECT uid FROM test_uuid WHERE id = ?', [10 + i]);
      assert.strictEqual(result.rows[0].uid.toLowerCase(), uuids[i].toLowerCase());
    }
  });
});
