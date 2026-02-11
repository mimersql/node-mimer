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

const mimer = require('./native');
const { PreparedStatement } = require('./prepared');
const { ResultSet } = require('./resultset');

/**
 * MimerClient provides a Promise-based interface to Mimer SQL
 */
class MimerClient {
  constructor() {
    this.connection = new mimer.Connection();
    this.connected = false;
  }

  /**
   * Connect to a Mimer SQL database
   * @param {Object} options - Connection options
   * @param {string} options.dsn - Database name
   * @param {string} options.user - Username
   * @param {string} options.password - Password
   * @returns {Promise<void>}
   */
  async connect(options) {
    const { dsn, user, password } = options;

    if (!dsn || !user || !password) {
      throw new Error('dsn, user, and password are required');
    }

    return new Promise((resolve, reject) => {
      try {
        const result = this.connection.connect(dsn, user, password);
        if (result) {
          this.connected = true;
          resolve();
        } else {
          reject(new Error('Connection failed'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute a SQL query
   * @param {string} sql - SQL statement to execute
   * @param {Array} params - Optional parameters (for future prepared statement support)
   * @returns {Promise<Object>} Result object with rows and metadata
   */
  async query(sql, params = []) {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve, reject) => {
      try {
        const result = this.connection.execute(sql, params);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Begin a transaction
   * @returns {Promise<void>}
   */
  async beginTransaction() {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve, reject) => {
      try {
        this.connection.beginTransaction();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Commit the current transaction
   * @returns {Promise<void>}
   */
  async commit() {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve, reject) => {
      try {
        this.connection.commit();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Rollback the current transaction
   * @returns {Promise<void>}
   */
  async rollback() {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve, reject) => {
      try {
        this.connection.rollback();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.connection.close();
        this.connected = false;
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Prepare a SQL statement for repeated execution
   * @param {string} sql - SQL statement with ? placeholders
   * @returns {Promise<PreparedStatement>}
   */
  async prepare(sql) {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve, reject) => {
      try {
        const stmt = this.connection.prepare(sql);
        resolve(new PreparedStatement(stmt));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Execute a SELECT query and return a cursor for row-at-a-time iteration.
   * @param {string} sql - SELECT statement (with optional ? placeholders)
   * @param {Array} params - Optional parameter values
   * @returns {Promise<ResultSet>}
   */
  async queryCursor(sql, params = []) {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    return new Promise((resolve, reject) => {
      try {
        const nativeRs = this.connection.executeQuery(sql, params);
        resolve(new ResultSet(nativeRs));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if connected to database
   * @returns {boolean}
   */
  isConnected() {
    return this.connection.isConnected();
  }
}

/**
 * Helper function to create a connection with options
 * @param {Object} options - Connection options
 * @returns {Promise<MimerClient>} Connected client instance
 */
async function connect(options) {
  const client = new MimerClient();
  await client.connect(options);
  return client;
}

module.exports = { MimerClient, connect };
