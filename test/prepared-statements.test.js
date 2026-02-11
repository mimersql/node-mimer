const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('prepared statements', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_prepared');
    await client.query('CREATE TABLE test_prepared (id INTEGER, name NVARCHAR(100))');
  });

  after(async () => {
    await dropTable(client, 'test_prepared');
    await client.close();
  });

  it('prepare INSERT + execute 3 times', async () => {
    const stmt = await client.prepare('INSERT INTO test_prepared VALUES (?, ?)');
    await stmt.execute([10, 'Prepared1']);
    await stmt.execute([11, 'Prepared2']);
    await stmt.execute([12, 'Prepared3']);
    await stmt.close();

    const result = await client.query(
      'SELECT * FROM test_prepared WHERE id >= 10 ORDER BY id'
    );
    assert.strictEqual(result.rowCount, 3);
    assert.strictEqual(result.rows[0].name, 'Prepared1');
    assert.strictEqual(result.rows[2].name, 'Prepared3');
  });

  it('prepare SELECT + reuse with different params', async () => {
    const stmt = await client.prepare('SELECT * FROM test_prepared WHERE id = ?');
    const r1 = await stmt.execute([10]);
    assert.strictEqual(r1.rows[0].name, 'Prepared1');
    const r2 = await stmt.execute([11]);
    assert.strictEqual(r2.rows[0].name, 'Prepared2');
    const r3 = await stmt.execute([12]);
    assert.strictEqual(r3.rows[0].name, 'Prepared3');
    await stmt.close();
  });

  it('execute after close throws', async () => {
    const stmt = await client.prepare('SELECT * FROM test_prepared WHERE id = ?');
    await stmt.close();
    await assert.rejects(
      () => stmt.execute([10]),
      { message: 'Statement is closed' }
    );
  });

  it('connection close invalidates open statements, double close is safe', async () => {
    const client2 = await createClient();
    const stmt = await client2.prepare('SELECT * FROM test_prepared WHERE id = ?');
    await client2.close();

    await assert.rejects(() => stmt.execute([1]));
    // Double close should be safe
    await stmt.close();
  });
});
