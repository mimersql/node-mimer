const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('basic queries', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_basic');
    await client.query('CREATE TABLE test_basic (id INTEGER, name NVARCHAR(100))');
  });

  after(async () => {
    await dropTable(client, 'test_basic');
    await client.close();
  });

  it('DDL: CREATE TABLE and DROP TABLE', async () => {
    await client.query('CREATE TABLE test_basic_ddl (x INTEGER)');
    await client.query('DROP TABLE test_basic_ddl');
  });

  it('DML: INSERT returns rowCount=1', async () => {
    const result = await client.query("INSERT INTO test_basic VALUES (1, 'Anna')");
    assert.strictEqual(result.rowCount, 1);
  });

  it('DML: DELETE returns affected count', async () => {
    await client.query("INSERT INTO test_basic VALUES (100, 'temp')");
    const result = await client.query('DELETE FROM test_basic WHERE id = 100');
    assert.strictEqual(result.rowCount, 1);
  });

  it('SELECT: returns correct rows', async () => {
    await client.query("INSERT INTO test_basic VALUES (2, 'Fredrik')");
    await client.query("INSERT INTO test_basic VALUES (3, 'Charlie')");
    const result = await client.query('SELECT * FROM test_basic ORDER BY id');
    assert.ok(result.rows.length >= 1);
    const row = result.rows.find(r => r.id === 2);
    assert.ok(row);
    assert.strictEqual(row.name, 'Fredrik');
  });

  it('SELECT: empty result for no-match', async () => {
    const result = await client.query('SELECT * FROM test_basic WHERE id = -999');
    assert.strictEqual(result.rowCount, 0);
    assert.deepStrictEqual(result.rows, []);
  });
});
