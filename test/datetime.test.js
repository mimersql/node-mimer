const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('DATE, TIME, and TIMESTAMP types', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_datetime');
    await client.query(
      'CREATE TABLE test_datetime (id INTEGER, d DATE, t TIME, ts TIMESTAMP)'
    );
  });

  after(async () => {
    await dropTable(client, 'test_datetime');
    await client.close();
  });

  it('DATE round-trip', async () => {
    await client.query('INSERT INTO test_datetime (id, d) VALUES (?, ?)', [1, '2025-06-15']);
    const result = await client.query('SELECT d FROM test_datetime WHERE id = ?', [1]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].d, '2025-06-15');
  });

  it('TIME round-trip', async () => {
    await client.query('INSERT INTO test_datetime (id, t) VALUES (?, ?)', [2, '14:30:59']);
    const result = await client.query('SELECT t FROM test_datetime WHERE id = ?', [2]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].t, '14:30:59');
  });

  it('TIMESTAMP round-trip', async () => {
    await client.query('INSERT INTO test_datetime (id, ts) VALUES (?, ?)', [3, '2025-06-15 14:30:59']);
    const result = await client.query('SELECT ts FROM test_datetime WHERE id = ?', [3]);
    assert.strictEqual(result.rowCount, 1);
    // Mimer returns fractional seconds even when zero
    assert.strictEqual(result.rows[0].ts, '2025-06-15 14:30:59.000000');
  });

  it('NULL date/time values', async () => {
    await client.query('INSERT INTO test_datetime (id, d, t, ts) VALUES (?, ?, ?, ?)', [4, null, null, null]);
    const result = await client.query('SELECT d, t, ts FROM test_datetime WHERE id = ?', [4]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].d, null);
    assert.strictEqual(result.rows[0].t, null);
    assert.strictEqual(result.rows[0].ts, null);
  });

  it('metadata shows correct type names', async () => {
    const result = await client.query('SELECT d, t, ts FROM test_datetime WHERE id = ?', [1]);
    assert.strictEqual(result.fields[0].dataTypeName, 'DATE');
    assert.strictEqual(result.fields[1].dataTypeName, 'TIME');
    assert.strictEqual(result.fields[2].dataTypeName, 'TIMESTAMP');
  });

  it('edge dates', async () => {
    await client.query('INSERT INTO test_datetime (id, d) VALUES (?, ?)', [5, '0001-01-01']);
    await client.query('INSERT INTO test_datetime (id, d) VALUES (?, ?)', [6, '9999-12-31']);
    const r1 = await client.query('SELECT d FROM test_datetime WHERE id = ?', [5]);
    const r2 = await client.query('SELECT d FROM test_datetime WHERE id = ?', [6]);
    assert.strictEqual(r1.rows[0].d, '0001-01-01');
    assert.strictEqual(r2.rows[0].d, '9999-12-31');
  });

  it('TIME with fractional seconds', async () => {
    await client.query(
      'DROP TABLE test_datetime_frac',
    ).catch(() => {});
    await client.query(
      'CREATE TABLE test_datetime_frac (id INTEGER, t TIME(6))'
    );
    await client.query('INSERT INTO test_datetime_frac (id, t) VALUES (?, ?)', [1, '08:15:30.123456']);
    const result = await client.query('SELECT t FROM test_datetime_frac WHERE id = ?', [1]);
    assert.strictEqual(result.rows[0].t, '08:15:30.123456');
    await client.query('DROP TABLE test_datetime_frac');
  });

  it('TIMESTAMP with fractional seconds', async () => {
    await client.query(
      'DROP TABLE test_datetime_tsfrac',
    ).catch(() => {});
    await client.query(
      'CREATE TABLE test_datetime_tsfrac (id INTEGER, ts TIMESTAMP(6))'
    );
    await client.query('INSERT INTO test_datetime_tsfrac (id, ts) VALUES (?, ?)', [1, '2025-12-31 23:59:59.999999']);
    const result = await client.query('SELECT ts FROM test_datetime_tsfrac WHERE id = ?', [1]);
    assert.strictEqual(result.rows[0].ts, '2025-12-31 23:59:59.999999');
    await client.query('DROP TABLE test_datetime_tsfrac');
  });
});
