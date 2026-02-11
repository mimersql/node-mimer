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

/**
 * ResultSet wraps a native cursor for row-at-a-time iteration.
 * Supports both manual next()/close() and async iteration (for-await-of).
 */
class ResultSet {
  constructor(nativeRs, onClose) {
    this._rs = nativeRs;
    this._fields = null;
    this._closed = false;
    this._onClose = onClose || null;
    this._onCloseCalled = false;
  }

  _invokeOnClose() {
    if (this._onClose && !this._onCloseCalled) {
      this._onCloseCalled = true;
      this._onClose();
    }
  }

  /**
   * Column metadata (lazy-loaded).
   * Each element: { name, dataTypeCode, dataTypeName, nullable }
   */
  get fields() {
    if (this._fields === null) {
      this._fields = this._rs.getFields();
    }
    return this._fields;
  }

  /**
   * Fetch the next row, or null when exhausted.
   * Automatically closes the cursor when the last row has been read.
   * @returns {Promise<Object|null>}
   */
  async next() {
    if (this._closed) {
      return null;
    }

    return new Promise((resolve, reject) => {
      try {
        const row = this._rs.fetchNext();
        if (row === null) {
          this._closed = true;
          this._rs.close();
          this._invokeOnClose();
        }
        resolve(row);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Close the cursor and release resources. Safe to call multiple times.
   * @returns {Promise<void>}
   */
  async close() {
    if (this._closed) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this._rs.close();
        this._closed = true;
        this._invokeOnClose();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Async iterator protocol for for-await-of support.
   */
  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        const row = await this.next();
        if (row === null) {
          return { done: true, value: undefined };
        }
        return { done: false, value: row };
      },
      return: async () => {
        await this.close();
        return { done: true, value: undefined };
      }
    };
  }
}

module.exports = { ResultSet };
