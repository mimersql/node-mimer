const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('parameterized queries', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_params');
    await dropTable(client, 'test_types');
    await client.query('CREATE TABLE test_params (id INTEGER, name NVARCHAR(100))');
    await client.query(
      'CREATE TABLE test_types (id INTEGER, name NVARCHAR(100), amount DOUBLE PRECISION, active BOOLEAN)'
    );
  });

  after(async () => {
    await dropTable(client, 'test_params');
    await dropTable(client, 'test_types');
    await client.close();
  });

  it('INSERT with ? params', async () => {
    const result = await client.query('INSERT INTO test_params VALUES (?, ?)', [1, 'David']);
    assert.strictEqual(result.rowCount, 1);
  });

  it('SELECT with ? in WHERE', async () => {
    await client.query('INSERT INTO test_params VALUES (?, ?)', [2, 'Eva']);
    const result = await client.query('SELECT * FROM test_params WHERE id = ?', [2]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].name, 'Eva');
  });

  it('multiple types: int, string, double, boolean', async () => {
    await client.query(
      'INSERT INTO test_types VALUES (?, ?, ?, ?)',
      [42, 'test string', 3.14, true]
    );
    const result = await client.query('SELECT * FROM test_types WHERE id = ?', [42]);
    assert.strictEqual(result.rows[0].id, 42);
    assert.strictEqual(result.rows[0].name, 'test string');
    assert.strictEqual(typeof result.rows[0].amount, 'number');
    assert.strictEqual(result.rows[0].active, true);
  });

  it('NULL parameters', async () => {
    await client.query('INSERT INTO test_types VALUES (?, ?, ?, ?)', [99, null, null, false]);
    const result = await client.query('SELECT * FROM test_types WHERE id = ?', [99]);
    assert.strictEqual(result.rows[0].name, null);
    assert.strictEqual(result.rows[0].amount, null);
  });

  it('param count mismatch throws with mimerCode and operation', async () => {
    await assert.rejects(
      () => client.query('INSERT INTO test_types VALUES (?, ?, ?, ?)', [1, 'only two']),
      (err) => {
        assert.strictEqual(typeof err.mimerCode, 'number');
        assert.strictEqual(typeof err.operation, 'string');
        return true;
      }
    );
  });
});
