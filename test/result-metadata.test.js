const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('result metadata', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_meta_basic');
    await dropTable(client, 'test_meta_multi');
    await client.query('CREATE TABLE test_meta_basic (id INTEGER, name NVARCHAR(100))');
    await client.query("INSERT INTO test_meta_basic VALUES (1, 'Anna')");
    await client.query(
      'CREATE TABLE test_meta_multi (a INTEGER NOT NULL, b NVARCHAR(50), c DOUBLE PRECISION, d BOOLEAN, e DATE)'
    );
  });

  after(async () => {
    await dropTable(client, 'test_meta_basic');
    await dropTable(client, 'test_meta_multi');
    await client.close();
  });

  it('fields array exists on SELECT', async () => {
    const result = await client.query('SELECT * FROM test_meta_basic');
    assert.ok(Array.isArray(result.fields));
    assert.strictEqual(result.fields.length, 2);
  });

  it('field properties have correct types', async () => {
    const result = await client.query('SELECT * FROM test_meta_basic');
    const field = result.fields[0];
    assert.strictEqual(typeof field.name, 'string');
    assert.strictEqual(typeof field.dataTypeCode, 'number');
    assert.strictEqual(typeof field.dataTypeName, 'string');
    assert.strictEqual(typeof field.nullable, 'boolean');
  });

  it('fields on zero-row result', async () => {
    const result = await client.query('SELECT * FROM test_meta_basic WHERE id = -999');
    assert.strictEqual(result.rowCount, 0);
    assert.ok(Array.isArray(result.fields));
    assert.strictEqual(result.fields.length, 2);
    assert.strictEqual(result.fields[0].name, 'id');
    assert.strictEqual(result.fields[1].name, 'name');
  });

  it('no fields on DML result', async () => {
    const result = await client.query("INSERT INTO test_meta_basic VALUES (99, 'temp')");
    assert.strictEqual(result.fields, undefined);
    assert.strictEqual(result.rowCount, 1);
    await client.query('DELETE FROM test_meta_basic WHERE id = 99');
  });

  it('multi-type table: correct type names', async () => {
    const result = await client.query('SELECT * FROM test_meta_multi');
    assert.strictEqual(result.fields.length, 5);

    const expectedNames = ['a', 'b', 'c', 'd', 'e'];
    for (let i = 0; i < expectedNames.length; i++) {
      assert.strictEqual(result.fields[i].name, expectedNames[i]);
    }

    assert.strictEqual(result.fields[0].dataTypeName, 'INTEGER');
    assert.strictEqual(result.fields[2].dataTypeName, 'DOUBLE PRECISION');
    assert.strictEqual(result.fields[3].dataTypeName, 'BOOLEAN');
    assert.strictEqual(result.fields[4].dataTypeName, 'DATE');

    for (const f of result.fields) {
      assert.strictEqual(typeof f.nullable, 'boolean');
    }
  });

  it('prepared statement result includes fields', async () => {
    const stmt = await client.prepare('SELECT * FROM test_meta_basic WHERE id = ?');
    const result = await stmt.execute([1]);
    assert.ok(Array.isArray(result.fields));
    assert.strictEqual(result.fields.length, 2);
    assert.strictEqual(result.fields[0].name, 'id');
    assert.strictEqual(result.fields[1].name, 'name');
    await stmt.close();
  });
});
