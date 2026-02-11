const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('LOB types (BLOB, NCLOB)', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_lob');
    await client.query(
      'CREATE TABLE test_lob (id INTEGER, data BLOB(10000), text NCLOB(10000))'
    );
  });

  after(async () => {
    await dropTable(client, 'test_lob');
    await client.close();
  });

  it('BLOB round-trip: insert and select Buffer', async () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x80]);
    await client.query('INSERT INTO test_lob (id, data) VALUES (?, ?)', [1, buf]);
    const result = await client.query('SELECT data FROM test_lob WHERE id = ?', [1]);
    assert.strictEqual(result.rowCount, 1);
    assert.ok(Buffer.isBuffer(result.rows[0].data));
    assert.deepStrictEqual(result.rows[0].data, buf);
  });

  it('NCLOB round-trip: insert and select string', async () => {
    const text = 'Hello, this is a CLOB test with unicode: äöü 你好 🎉';
    await client.query('INSERT INTO test_lob (id, text) VALUES (?, ?)', [2, text]);
    const result = await client.query('SELECT text FROM test_lob WHERE id = ?', [2]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].text, text);
  });

  it('NULL LOB values', async () => {
    await client.query('INSERT INTO test_lob (id, data, text) VALUES (?, ?, ?)', [3, null, null]);
    const result = await client.query('SELECT data, text FROM test_lob WHERE id = ?', [3]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].data, null);
    assert.strictEqual(result.rows[0].text, null);
  });

  it('empty BLOB value', async () => {
    const buf = Buffer.alloc(0);
    await client.query('INSERT INTO test_lob (id, data) VALUES (?, ?)', [4, buf]);
    const result = await client.query('SELECT data FROM test_lob WHERE id = ?', [4]);
    assert.strictEqual(result.rowCount, 1);
    assert.ok(Buffer.isBuffer(result.rows[0].data));
    assert.strictEqual(result.rows[0].data.length, 0);
  });

  it('empty NCLOB value', async () => {
    await client.query('INSERT INTO test_lob (id, text) VALUES (?, ?)', [5, '']);
    const result = await client.query('SELECT text FROM test_lob WHERE id = ?', [5]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].text, '');
  });

  it('larger BLOB data', async () => {
    const buf = Buffer.alloc(5000);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = i % 256;
    }
    await client.query('INSERT INTO test_lob (id, data) VALUES (?, ?)', [6, buf]);
    const result = await client.query('SELECT data FROM test_lob WHERE id = ?', [6]);
    assert.strictEqual(result.rowCount, 1);
    assert.deepStrictEqual(result.rows[0].data, buf);
  });

  it('larger NCLOB data', async () => {
    const text = 'Lorem ipsum dolor sit amet. '.repeat(200);
    await client.query('INSERT INTO test_lob (id, text) VALUES (?, ?)', [7, text]);
    const result = await client.query('SELECT text FROM test_lob WHERE id = ?', [7]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].text, text);
  });

  it('metadata shows BLOB and NCLOB type names', async () => {
    const result = await client.query('SELECT data, text FROM test_lob WHERE id = ?', [1]);
    assert.strictEqual(result.fields[0].dataTypeName, 'BLOB');
    assert.strictEqual(result.fields[1].dataTypeName, 'NCLOB');
  });
});

describe('LOB chunked reading', () => {
  let client;

  before(async () => {
    client = await createClient();
    await dropTable(client, 'test_lob_large');
    await client.query(
      'CREATE TABLE test_lob_large (id INTEGER, data BLOB(500000), text NCLOB(500000))'
    );
  });

  after(async () => {
    await dropTable(client, 'test_lob_large');
    await client.close();
  });

  it('BLOB larger than 64KB chunk size', async () => {
    const buf = Buffer.alloc(100000);
    for (let i = 0; i < buf.length; i++) {
      buf[i] = i % 256;
    }
    await client.query('INSERT INTO test_lob_large (id, data) VALUES (?, ?)', [1, buf]);
    const result = await client.query('SELECT data FROM test_lob_large WHERE id = ?', [1]);
    assert.strictEqual(result.rowCount, 1);
    assert.deepStrictEqual(result.rows[0].data, buf);
  });

  it('NCLOB larger than 64KB with multi-byte characters', async () => {
    // 4-byte emoji repeated to push well past 64KB chunk boundary
    // 20000 x 4-byte emoji = 80000 bytes, ~20000 characters
    const emoji = '\u{1F600}'; // 😀, 4 bytes in UTF-8
    const text = emoji.repeat(20000);
    await client.query('INSERT INTO test_lob_large (id, text) VALUES (?, ?)', [2, text]);
    const result = await client.query('SELECT text FROM test_lob_large WHERE id = ?', [2]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].text, text);
  });

  it('NCLOB with mixed ASCII and multi-byte spanning chunk boundary', async () => {
    // Mix of 1-byte ASCII and 3-byte CJK characters
    // ~21000 chars of 3-byte CJK = ~63000 bytes, then ASCII to push past 65536
    const cjk = '\u4e16'.repeat(21000); // 世 = 3 bytes each
    const ascii = 'A'.repeat(5000);
    const text = cjk + ascii;
    await client.query('INSERT INTO test_lob_large (id, text) VALUES (?, ?)', [3, text]);
    const result = await client.query('SELECT text FROM test_lob_large WHERE id = ?', [3]);
    assert.strictEqual(result.rowCount, 1);
    assert.strictEqual(result.rows[0].text, text);
  });
});
