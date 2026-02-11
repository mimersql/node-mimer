const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createPool } = require('../index');
const { createClient, dropTable } = require('./helper');

const POOL_OPTS = {
  dsn: 'mimerdb',
  user: 'SYSADM',
  password: 'SYSADM',
};

describe('connection pool', () => {
  let setupClient;
  const TABLE = 'test_pool';

  before(async () => {
    setupClient = await createClient();
    await dropTable(setupClient, TABLE);
    await setupClient.query(
      `CREATE TABLE ${TABLE} (id INTEGER, name NVARCHAR(100))`
    );
    const stmt = await setupClient.prepare(
      `INSERT INTO ${TABLE} VALUES (?, ?)`
    );
    for (let i = 1; i <= 5; i++) {
      await stmt.execute([i, `row${i}`]);
    }
    await stmt.close();
  });

  after(async () => {
    await dropTable(setupClient, TABLE);
    await setupClient.close();
  });

  it('pool.query() executes and returns result', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      const result = await pool.query(
        `SELECT id, name FROM ${TABLE} ORDER BY id`
      );
      assert.strictEqual(result.rows.length, 5);
      assert.strictEqual(result.rows[0].id, 1);
      assert.strictEqual(result.rows[0].name, 'row1');
    } finally {
      await pool.end();
    }
  });

  it('pool.queryCursor() streams rows and releases connection', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 1 });
    try {
      const cursor = await pool.queryCursor(
        `SELECT id FROM ${TABLE} ORDER BY id`
      );
      const ids = [];
      for await (const row of cursor) {
        ids.push(row.id);
      }
      assert.deepStrictEqual(ids, [1, 2, 3, 4, 5]);

      // Connection should be released — another query should work
      const result = await pool.query(`SELECT COUNT(*) AS cnt FROM ${TABLE}`);
      assert.strictEqual(result.rows[0].cnt, 5);
    } finally {
      await pool.end();
    }
  });

  it('pool.connect() returns PoolClient with release()', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      const client = await pool.connect();
      const result = await client.query(
        `SELECT id FROM ${TABLE} ORDER BY id`
      );
      assert.strictEqual(result.rows.length, 5);
      client.release();
    } finally {
      await pool.end();
    }
  });

  it('transaction via PoolClient', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      const client = await pool.connect();
      try {
        await client.beginTransaction();
        await client.query(
          `INSERT INTO ${TABLE} VALUES (?, ?)`,
          [99, 'txn_row']
        );
        await client.rollback();
      } finally {
        client.release();
      }

      // Row should NOT exist after rollback
      const result = await pool.query(
        `SELECT id FROM ${TABLE} WHERE id = 99`
      );
      assert.strictEqual(result.rows.length, 0);
    } finally {
      await pool.end();
    }
  });

  it('connections are reused', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      // First query creates a connection
      await pool.query(`SELECT 1 AS x FROM system.onerow`);
      assert.strictEqual(pool.totalCount, 1);

      // Second query should reuse it
      await pool.query(`SELECT 2 AS x FROM system.onerow`);
      assert.strictEqual(pool.totalCount, 1);
    } finally {
      await pool.end();
    }
  });

  it('pool respects max limit', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2, acquireTimeout: 500 });
    try {
      const c1 = await pool.connect();
      const c2 = await pool.connect();

      // Pool is full — third connect should timeout
      await assert.rejects(() => pool.connect(), {
        message: /Acquire timeout/,
      });

      c1.release();
      c2.release();
    } finally {
      await pool.end();
    }
  });

  it('waiter gets connection when one is released', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 1, acquireTimeout: 5000 });
    try {
      const c1 = await pool.connect();

      // Start waiting for a connection in the background
      const pendingConnect = pool.connect();

      // Release after a short delay
      setTimeout(() => c1.release(), 50);

      const c2 = await pendingConnect;
      const result = await c2.query(`SELECT 1 AS x FROM system.onerow`);
      assert.strictEqual(result.rows[0].x, 1);
      c2.release();
    } finally {
      await pool.end();
    }
  });

  it('pool.end() closes all connections', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    await pool.query(`SELECT 1 AS x FROM system.onerow`);
    await pool.end();

    assert.strictEqual(pool.idleCount, 0);
  });

  it('operations after pool.end() reject', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    await pool.end();

    await assert.rejects(() => pool.query(`SELECT 1 AS x FROM system.onerow`), {
      message: /Pool is closed/,
    });
  });

  it('double release is safe', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      const client = await pool.connect();
      client.release();
      client.release(); // should not throw
    } finally {
      await pool.end();
    }
  });

  it('queryCursor early break releases connection', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 1 });
    try {
      const cursor = await pool.queryCursor(
        `SELECT id FROM ${TABLE} ORDER BY id`
      );
      for await (const row of cursor) {
        if (row.id === 2) break;
      }

      // Connection should be released — pool should allow another query
      const result = await pool.query(`SELECT COUNT(*) AS cnt FROM ${TABLE}`);
      assert.strictEqual(result.rows[0].cnt, 5);
    } finally {
      await pool.end();
    }
  });

  it('idleTimeout closes idle connections', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2, idleTimeout: 100 });
    try {
      await pool.query(`SELECT 1 AS x FROM system.onerow`);
      assert.strictEqual(pool.totalCount, 1);

      // Wait for idle timeout to fire
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.strictEqual(pool.totalCount, 0);
    } finally {
      await pool.end();
    }
  });

  it('pool.end() rejects pending waiters', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 1, acquireTimeout: 5000 });
    const c1 = await pool.connect();

    // Start waiting
    const pendingConnect = pool.connect();

    // End the pool while waiter is pending
    await pool.end();
    c1.release();

    await assert.rejects(() => pendingConnect, {
      message: /Pool is closed/,
    });
  });

  it('PoolClient.prepare() works', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      const client = await pool.connect();
      try {
        const stmt = await client.prepare(
          `SELECT id, name FROM ${TABLE} WHERE id = ?`
        );
        const result = await stmt.execute([3]);
        assert.strictEqual(result.rows.length, 1);
        assert.strictEqual(result.rows[0].name, 'row3');
        await stmt.close();
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  it('PoolClient.queryCursor() works', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 2 });
    try {
      const client = await pool.connect();
      try {
        const cursor = await client.queryCursor(
          `SELECT id FROM ${TABLE} ORDER BY id`
        );
        const ids = [];
        for await (const row of cursor) {
          ids.push(row.id);
        }
        assert.deepStrictEqual(ids, [1, 2, 3, 4, 5]);
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  it('concurrent pool.query() calls', async () => {
    const pool = createPool({ ...POOL_OPTS, max: 3 });
    try {
      const results = await Promise.all([
        pool.query(`SELECT 1 AS x FROM system.onerow`),
        pool.query(`SELECT 2 AS x FROM system.onerow`),
        pool.query(`SELECT 3 AS x FROM system.onerow`),
      ]);
      assert.strictEqual(results[0].rows[0].x, 1);
      assert.strictEqual(results[1].rows[0].x, 2);
      assert.strictEqual(results[2].rows[0].x, 3);
    } finally {
      await pool.end();
    }
  });
});
