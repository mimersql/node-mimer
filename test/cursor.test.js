const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient, dropTable } = require('./helper');

describe('cursor / streaming results', () => {
  let client;
  const TABLE = 'test_cursor';

  before(async () => {
    client = await createClient();
    await dropTable(client, TABLE);
    await client.query(
      `CREATE TABLE ${TABLE} (id INTEGER, name NVARCHAR(100))`
    );
    // Insert 10 rows
    const stmt = await client.prepare(`INSERT INTO ${TABLE} VALUES (?, ?)`);
    for (let i = 1; i <= 10; i++) {
      await stmt.execute([i, `row${i}`]);
    }
    await stmt.close();
  });

  after(async () => {
    await dropTable(client, TABLE);
    await client.close();
  });

  it('queryCursor returns ResultSet with fields metadata', async () => {
    const cursor = await client.queryCursor(
      `SELECT id, name FROM ${TABLE} ORDER BY id`
    );
    const fields = cursor.fields;
    assert.strictEqual(fields.length, 2);
    assert.strictEqual(fields[0].name, 'id');
    assert.strictEqual(fields[1].name, 'name');
    await cursor.close();
  });

  it('manual next() iterates all rows', async () => {
    const cursor = await client.queryCursor(
      `SELECT id, name FROM ${TABLE} ORDER BY id`
    );

    const rows = [];
    let row;
    while ((row = await cursor.next()) !== null) {
      rows.push(row);
    }

    assert.strictEqual(rows.length, 10);
    assert.strictEqual(rows[0].id, 1);
    assert.strictEqual(rows[0].name, 'row1');
    assert.strictEqual(rows[9].id, 10);
    assert.strictEqual(rows[9].name, 'row10');
  });

  it('for-await-of iteration', async () => {
    const cursor = await client.queryCursor(
      `SELECT id FROM ${TABLE} ORDER BY id`
    );

    const ids = [];
    for await (const row of cursor) {
      ids.push(row.id);
    }

    assert.deepStrictEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('early break cleans up cursor', async () => {
    const cursor = await client.queryCursor(
      `SELECT id FROM ${TABLE} ORDER BY id`
    );

    const ids = [];
    for await (const row of cursor) {
      ids.push(row.id);
      if (row.id === 3) break;
    }

    assert.deepStrictEqual(ids, [1, 2, 3]);
    // Cursor should be closed after break
    const afterBreak = await cursor.next();
    assert.strictEqual(afterBreak, null);
  });

  it('close() safe to call multiple times', async () => {
    const cursor = await client.queryCursor(
      `SELECT id FROM ${TABLE} ORDER BY id`
    );
    await cursor.close();
    await cursor.close(); // should not throw
  });

  it('next() after close returns null', async () => {
    const cursor = await client.queryCursor(
      `SELECT id FROM ${TABLE} ORDER BY id`
    );
    await cursor.close();
    const row = await cursor.next();
    assert.strictEqual(row, null);
  });

  it('parameterized cursor query', async () => {
    const cursor = await client.queryCursor(
      `SELECT id, name FROM ${TABLE} WHERE id > ? ORDER BY id`,
      [7]
    );

    const rows = [];
    for await (const row of cursor) {
      rows.push(row);
    }

    assert.strictEqual(rows.length, 3);
    assert.strictEqual(rows[0].id, 8);
    assert.strictEqual(rows[2].id, 10);
  });

  it('empty result set', async () => {
    const cursor = await client.queryCursor(
      `SELECT id FROM ${TABLE} WHERE id > 999`
    );

    const rows = [];
    for await (const row of cursor) {
      rows.push(row);
    }

    assert.strictEqual(rows.length, 0);
  });

  it('DDL rejected', async () => {
    await assert.rejects(
      () => client.queryCursor(`CREATE TABLE should_not_exist (x INTEGER)`),
      { message: /SELECT/ }
    );
  });

  it('DML rejected', async () => {
    await assert.rejects(
      () => client.queryCursor(`INSERT INTO ${TABLE} VALUES (99, 'nope')`),
      { message: /SELECT/ }
    );
  });

  it('connection close invalidates open cursor', async () => {
    const client2 = await createClient();
    const cursor = await client2.queryCursor(
      `SELECT id FROM ${TABLE} ORDER BY id`
    );

    // Read one row to prove it works
    const first = await cursor.next();
    assert.strictEqual(first.id, 1);

    // Close connection — should invalidate cursor
    await client2.close();

    // next() should return null (cursor was closed)
    const afterClose = await cursor.next();
    assert.strictEqual(afterClose, null);

    // close() should be safe
    await cursor.close();
  });
});
