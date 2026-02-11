const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('./helper');

describe('connection', () => {
  it('connects successfully', async () => {
    const client = await createClient();
    assert.ok(client);
    await client.close();
  });

  it('isConnected() returns true after connect', async () => {
    const client = await createClient();
    assert.strictEqual(client.isConnected(), true);
    await client.close();
  });

  it('isConnected() returns false after close', async () => {
    const client = await createClient();
    await client.close();
    assert.strictEqual(client.isConnected(), false);
  });

  it('double close does not throw', async () => {
    const client = await createClient();
    await client.close();
    await client.close();
  });
});
