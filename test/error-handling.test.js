const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('./helper');

describe('error handling', () => {
  let client;

  before(async () => {
    client = await createClient();
  });

  after(async () => {
    await client.close();
  });

  it('error has numeric mimerCode', async () => {
    try {
      await client.query('SELECT * FROM nonexistent_table_xyz');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(typeof err.mimerCode, 'number');
    }
  });

  it('error has string operation', async () => {
    try {
      await client.query('SELECT * FROM nonexistent_table_xyz');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(typeof err.operation, 'string');
    }
  });

  it('error has descriptive message', async () => {
    try {
      await client.query('SELECT * FROM nonexistent_table_xyz');
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err.message.length > 0);
    }
  });

  it('querying on closed connection throws', async () => {
    const client2 = await createClient();
    await client2.close();
    await assert.rejects(
      () => client2.query('SELECT 1'),
      { message: 'Not connected to database' }
    );
  });
});
