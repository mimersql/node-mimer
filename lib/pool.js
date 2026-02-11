// Copyright (c) 2026 Mimer Information Technology
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// See license for more details.

const { connect } = require('./client');
const { ResultSet } = require('./resultset');

/**
 * PoolClient wraps a MimerClient checked out from a Pool.
 * Call release() to return the connection to the pool instead of close().
 */
class PoolClient {
  constructor(client, releaseCallback) {
    this._client = client;
    this._releaseCallback = releaseCallback;
    this._released = false;
  }

  async query(sql, params) {
    return this._client.query(sql, params);
  }

  async queryCursor(sql, params) {
    return this._client.queryCursor(sql, params);
  }

  async prepare(sql) {
    return this._client.prepare(sql);
  }

  async beginTransaction() {
    return this._client.beginTransaction();
  }

  async commit() {
    return this._client.commit();
  }

  async rollback() {
    return this._client.rollback();
  }

  release() {
    if (this._released) {
      return;
    }
    this._released = true;
    this._releaseCallback(this._client);
  }
}

/**
 * Pool manages a set of reusable MimerClient connections.
 */
class Pool {
  constructor(options) {
    const { dsn, user, password, max, idleTimeout, acquireTimeout } = options;
    if (!dsn || !user || !password) {
      throw new Error('dsn, user, and password are required');
    }
    this._dsn = dsn;
    this._user = user;
    this._password = password;
    this._max = max || 10;
    this._idleTimeout = idleTimeout !== undefined ? idleTimeout : 30000;
    this._acquireTimeout = acquireTimeout !== undefined ? acquireTimeout : 5000;

    this._pool = [];       // idle clients
    this._active = 0;      // checked-out count
    this._waiters = [];    // { resolve, reject, timer }
    this._closed = false;
    this._idleTimers = new Map();
  }

  get totalCount() {
    return this._pool.length + this._active;
  }

  get idleCount() {
    return this._pool.length;
  }

  get activeCount() {
    return this._active;
  }

  get waitingCount() {
    return this._waiters.length;
  }

  async _acquire() {
    if (this._closed) {
      throw new Error('Pool is closed');
    }

    // 1. Reuse an idle connection
    if (this._pool.length > 0) {
      const client = this._pool.pop();
      const timer = this._idleTimers.get(client);
      if (timer) {
        clearTimeout(timer);
        this._idleTimers.delete(client);
      }
      this._active++;
      return client;
    }

    // 2. Create a new connection if under the limit
    if (this.totalCount < this._max) {
      this._active++;
      try {
        const client = await connect({
          dsn: this._dsn,
          user: this._user,
          password: this._password,
        });
        return client;
      } catch (err) {
        this._active--;
        throw err;
      }
    }

    // 3. Wait for a connection to be released
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this._waiters.findIndex((w) => w.resolve === resolve);
        if (idx !== -1) {
          this._waiters.splice(idx, 1);
        }
        reject(new Error('Acquire timeout: no available connections'));
      }, this._acquireTimeout);

      this._waiters.push({ resolve, reject, timer });
    });
  }

  _release(client) {
    if (this._closed) {
      this._active--;
      client.close().catch(() => {});
      return;
    }

    // Hand off to a waiter if one is waiting
    if (this._waiters.length > 0) {
      const waiter = this._waiters.shift();
      clearTimeout(waiter.timer);
      waiter.resolve(client);
      return;
    }

    // Return to idle pool
    this._active--;
    this._pool.push(client);

    // Set idle timer
    if (this._idleTimeout > 0) {
      const timer = setTimeout(() => {
        const idx = this._pool.indexOf(client);
        if (idx !== -1) {
          this._pool.splice(idx, 1);
          this._idleTimers.delete(client);
          client.close().catch(() => {});
        }
      }, this._idleTimeout);
      timer.unref();
      this._idleTimers.set(client, timer);
    }
  }

  async query(sql, params) {
    const client = await this._acquire();
    try {
      return await client.query(sql, params);
    } finally {
      this._release(client);
    }
  }

  async queryCursor(sql, params) {
    const client = await this._acquire();
    try {
      const nativeRs = client.connection.executeQuery(sql, params || []);
      const rs = new ResultSet(nativeRs, () => {
        this._release(client);
      });
      return rs;
    } catch (err) {
      this._release(client);
      throw err;
    }
  }

  async connect() {
    const client = await this._acquire();
    return new PoolClient(client, (c) => this._release(c));
  }

  async end() {
    this._closed = true;

    // Reject all waiters
    for (const waiter of this._waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Pool is closed'));
    }
    this._waiters = [];

    // Close all idle connections and clear their timers
    for (const [, timer] of this._idleTimers) {
      clearTimeout(timer);
    }
    this._idleTimers.clear();

    const closePromises = this._pool.map((client) =>
      client.close().catch(() => {})
    );
    this._pool = [];
    await Promise.all(closePromises);
  }
}

module.exports = { Pool, PoolClient };
