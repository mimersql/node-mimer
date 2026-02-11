const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('transactions', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_txn');
    await client.query('CREATE TABLE test_txn (id INTEGER, name NVARCHAR(100))');
    await client.query("INSERT INTO test_txn VALUES (1, 'Anna')");
    await client.query("INSERT INTO test_txn VALUES (2, 'Fredrik')");
    await client.query("INSERT INTO test_txn VALUES (3, 'Charlie')");
  });

  after(async () => {
    await dropTable(client, 'test_txn');
    await client.close();
  });

  it('rollback reverts uncommitted INSERT', async () => {
    await client.beginTransaction();
    await client.query("INSERT INTO test_txn VALUES (4, 'David')");
    await client.rollback();

    const result = await client.query('SELECT COUNT(*) as cnt FROM test_txn');
    assert.strictEqual(result.rows[0].cnt, 3);
  });

  it('commit persists INSERT', async () => {
    await client.beginTransaction();
    await client.query("INSERT INTO test_txn VALUES (5, 'Eva')");
    await client.commit();

    const result = await client.query('SELECT COUNT(*) as cnt FROM test_txn');
    assert.strictEqual(result.rows[0].cnt, 4);
  });
});
