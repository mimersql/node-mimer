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

'use strict';

const koffi = require('koffi');
const findMimerLibrary = require('./find-mimer-library');

// ---------------------------------------------------------------------------
// Load the Mimer SQL shared library
// ---------------------------------------------------------------------------
const libPath = findMimerLibrary();
const lib = koffi.load(libPath);

// ---------------------------------------------------------------------------
// Opaque pointer types
// ---------------------------------------------------------------------------
const MimerSession = koffi.pointer('MimerSession', koffi.opaque());
const MimerStatement = koffi.pointer('MimerStatement', koffi.opaque());
const MimerLob = koffi.pointer('MimerLob', koffi.opaque());

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MIMER_SUCCESS = 0;
const MIMER_NO_DATA = 100;
const MIMER_FORWARD_ONLY = 0;
const MIMER_COMMIT = 0;
const MIMER_ROLLBACK = 1;
const MIMER_TRANS_READWRITE = 0;
const MIMER_STATEMENT_CANNOT_BE_PREPARED = -24005;

// Type codes
const MIMER_CHARACTER = 1;
const MIMER_DECIMAL = 2;
const MIMER_INTEGER = 3;
const MIMER_FLOAT = 4;
const MIMER_LIKE_PATTERN = 5;
const MIMER_T_INTEGER = 6;
const MIMER_T_SMALLINT = 7;
const MIMER_T_FLOAT = 8;
const MIMER_T_REAL = 9;
const MIMER_T_DOUBLE = 10;
const MIMER_CHARACTER_VARYING = 11;
const MIMER_DATE = 12;
const MIMER_TIME = 13;
const MIMER_TIMESTAMP = 14;
const MIMER_INTERVAL_YEAR = 15;
const MIMER_INTERVAL_MINUTE_TO_SECOND = 27;
const MIMER_UNSIGNED_INTEGER = 28;
const MIMER_T_UNSIGNED_INTEGER = 29;
const MIMER_T_UNSIGNED_SMALLINT = 30;
const MIMER_NUMERIC = 31;
const MIMER_T_BIGINT = 32;
const MIMER_T_UNSIGNED_BIGINT = 33;
const MIMER_BINARY = 34;
const MIMER_BINARY_VARYING = 35;
const MIMER_BLOB = 37;
const MIMER_CLOB = 38;
const MIMER_NCHAR = 39;
const MIMER_NCHAR_VARYING = 40;
const MIMER_NCLOB = 41;
const MIMER_BOOLEAN = 42;
const MIMER_BLOB_LOCATOR = 43;
const MIMER_CLOB_LOCATOR = 44;
const MIMER_NCLOB_LOCATOR = 45;
const MIMER_NATIVE_SMALLINT = 47;
const MIMER_NATIVE_SMALLINT_NULLABLE = 48;
const MIMER_NATIVE_INTEGER = 49;
const MIMER_NATIVE_INTEGER_NULLABLE = 50;
const MIMER_NATIVE_BIGINT = 51;
const MIMER_NATIVE_BIGINT_NULLABLE = 52;
const MIMER_NATIVE_REAL = 53;
const MIMER_NATIVE_REAL_NULLABLE = 54;
const MIMER_NATIVE_DOUBLE = 55;
const MIMER_NATIVE_DOUBLE_NULLABLE = 56;
const MIMER_NATIVE_BLOB = 57;
const MIMER_NATIVE_CLOB = 58;
const MIMER_NATIVE_NCLOB = 59;
const MIMER_NATIVE_BLOB_LOCATOR = 60;
const MIMER_NATIVE_CLOB_LOCATOR = 61;
const MIMER_NATIVE_NCLOB_LOCATOR = 62;
const MIMER_UTF8 = 63;
const MIMER_UUID = 8104;

const LOB_READ_CHUNK = 65536;
const LOB_WRITE_CHUNK = 2 * 1024 * 1024;

// ---------------------------------------------------------------------------
// FFI function declarations
// ---------------------------------------------------------------------------
const MimerBeginSession8 = lib.func('int32_t MimerBeginSession8(str, str, str, _Out_ MimerSession *)');
const MimerEndSession = lib.func('int32_t MimerEndSession(_Inout_ MimerSession *)');
const MimerBeginStatement8 = lib.func('int32_t MimerBeginStatement8(MimerSession, str, int32_t, _Out_ MimerStatement *)');
const MimerEndStatement = lib.func('int32_t MimerEndStatement(_Inout_ MimerStatement *)');
const MimerExecuteStatement8 = lib.func('int32_t MimerExecuteStatement8(MimerSession, str)');
const MimerExecute = lib.func('int32_t MimerExecute(MimerStatement)');
const MimerOpenCursor = lib.func('int32_t MimerOpenCursor(MimerStatement)');
const MimerFetch = lib.func('int32_t MimerFetch(MimerStatement)');
const MimerCloseCursor = lib.func('int32_t MimerCloseCursor(MimerStatement)');
const MimerColumnCount = lib.func('int32_t MimerColumnCount(MimerStatement)');
const MimerColumnName8 = lib.func('int32_t MimerColumnName8(MimerStatement, int16_t, _Out_ uint8_t *, size_t)');
const MimerColumnType = lib.func('int32_t MimerColumnType(MimerStatement, int16_t)');
const MimerParameterCount = lib.func('int32_t MimerParameterCount(MimerStatement)');
const MimerParameterType = lib.func('int32_t MimerParameterType(MimerStatement, int16_t)');
const MimerIsNull = lib.func('int32_t MimerIsNull(MimerStatement, int16_t)');
const MimerSetNull = lib.func('int32_t MimerSetNull(MimerStatement, int16_t)');
const MimerSetString8 = lib.func('int32_t MimerSetString8(MimerStatement, int16_t, str)');
const MimerSetInt32 = lib.func('int32_t MimerSetInt32(MimerStatement, int16_t, int32_t)');
const MimerSetInt64 = lib.func('int32_t MimerSetInt64(MimerStatement, int16_t, int64_t)');
const MimerSetDouble = lib.func('int32_t MimerSetDouble(MimerStatement, int16_t, double)');
const MimerSetBoolean = lib.func('int32_t MimerSetBoolean(MimerStatement, int16_t, int32_t)');
const MimerSetBinary = lib.func('int32_t MimerSetBinary(MimerStatement, int16_t, _In_ uint8_t *, size_t)');
const MimerGetString8 = lib.func('int32_t MimerGetString8(MimerStatement, int16_t, _Out_ uint8_t *, size_t)');
const MimerGetInt32 = lib.func('int32_t MimerGetInt32(MimerStatement, int16_t, _Out_ int32_t *)');
const MimerGetInt64 = lib.func('int32_t MimerGetInt64(MimerStatement, int16_t, _Out_ int64_t *)');
const MimerGetDouble = lib.func('int32_t MimerGetDouble(MimerStatement, int16_t, _Out_ double *)');
const MimerGetFloat = lib.func('int32_t MimerGetFloat(MimerStatement, int16_t, _Out_ float *)');
const MimerGetBoolean = lib.func('int32_t MimerGetBoolean(MimerStatement, int16_t)');
const MimerGetBinary = lib.func('int32_t MimerGetBinary(MimerStatement, int16_t, _Out_ uint8_t *, size_t)');
const MimerBeginTransaction = lib.func('int32_t MimerBeginTransaction(MimerSession, int32_t)');
const MimerEndTransaction = lib.func('int32_t MimerEndTransaction(MimerSession, int32_t)');
const MimerSetLob = lib.func('int32_t MimerSetLob(MimerStatement, int16_t, size_t, _Out_ MimerLob *)');
const MimerSetBlobData = lib.func('int32_t MimerSetBlobData(_Inout_ MimerLob *, _In_ uint8_t *, size_t)');
const MimerSetNclobData8 = lib.func('int32_t MimerSetNclobData8(_Inout_ MimerLob *, str, size_t)');
const MimerGetLob = lib.func('int32_t MimerGetLob(MimerStatement, int16_t, _Out_ size_t *, _Out_ MimerLob *)');
const MimerGetBlobData = lib.func('int32_t MimerGetBlobData(_Inout_ MimerLob *, _Out_ uint8_t *, size_t)');
const MimerGetNclobData8 = lib.func('int32_t MimerGetNclobData8(_Inout_ MimerLob *, _Out_ uint8_t *, size_t)');
const MimerGetError8 = lib.func('int32_t MimerGetError8(MimerSession, _Out_ int32_t *, _Out_ uint8_t *, size_t)');

// ---------------------------------------------------------------------------
// Type detection functions (ported from mimerapi.h macros)
// ---------------------------------------------------------------------------
function mimerIsInt32(n) {
  const a = Math.abs(n);
  return a === MIMER_T_INTEGER || a === MIMER_T_SMALLINT
      || a === MIMER_T_UNSIGNED_INTEGER || a === MIMER_T_UNSIGNED_SMALLINT
      || (a >= MIMER_NATIVE_SMALLINT && a <= MIMER_NATIVE_BIGINT_NULLABLE);
}

function mimerIsInt64(n) {
  const a = Math.abs(n);
  return a === MIMER_T_BIGINT || a === MIMER_T_UNSIGNED_BIGINT
      || a === MIMER_NATIVE_BIGINT || a === MIMER_NATIVE_BIGINT_NULLABLE;
}

function mimerIsDouble(n) {
  const a = Math.abs(n);
  return a === MIMER_T_DOUBLE || a === MIMER_NATIVE_DOUBLE
      || a === MIMER_NATIVE_DOUBLE_NULLABLE;
}

function mimerIsFloat(n) {
  const a = Math.abs(n);
  return a === MIMER_T_FLOAT || a === MIMER_T_REAL
      || a === MIMER_NATIVE_REAL || a === MIMER_NATIVE_REAL_NULLABLE;
}

function mimerIsBoolean(n) {
  return Math.abs(n) === MIMER_BOOLEAN;
}

function mimerIsBlob(n) {
  const a = Math.abs(n);
  return a === MIMER_BLOB || a === MIMER_BLOB_LOCATOR
      || a === MIMER_NATIVE_BLOB || a === MIMER_NATIVE_BLOB_LOCATOR;
}

function mimerIsClob(n) {
  const a = Math.abs(n);
  return a === MIMER_CLOB || a === MIMER_CLOB_LOCATOR
      || a === MIMER_NATIVE_CLOB || a === MIMER_NATIVE_CLOB_LOCATOR;
}

function mimerIsNclob(n) {
  const a = Math.abs(n);
  return a === MIMER_NCLOB || a === MIMER_NCLOB_LOCATOR
      || a === MIMER_NATIVE_NCLOB || a === MIMER_NATIVE_NCLOB_LOCATOR
      || mimerIsClob(n);
}

function mimerIsBinary(n) {
  const a = Math.abs(n);
  return a === MIMER_BINARY || a === MIMER_BINARY_VARYING;
}

// ---------------------------------------------------------------------------
// Type name mapping (ported from helpers.cc MimerTypeName)
// ---------------------------------------------------------------------------
const TYPE_NAMES = {
  [MIMER_CHARACTER]: 'CHARACTER',
  [MIMER_CHARACTER_VARYING]: 'CHARACTER VARYING',
  [MIMER_NCHAR]: 'NCHAR',
  [MIMER_NCHAR_VARYING]: 'NCHAR VARYING',
  [MIMER_UTF8]: 'NVARCHAR',
  [MIMER_DECIMAL]: 'DECIMAL',
  [MIMER_NUMERIC]: 'NUMERIC',
  [MIMER_INTEGER]: 'INTEGER',
  [MIMER_UNSIGNED_INTEGER]: 'INTEGER',
  [MIMER_T_INTEGER]: 'INTEGER',
  [MIMER_T_UNSIGNED_INTEGER]: 'INTEGER',
  [MIMER_T_SMALLINT]: 'SMALLINT',
  [MIMER_T_UNSIGNED_SMALLINT]: 'SMALLINT',
  [MIMER_T_BIGINT]: 'BIGINT',
  [MIMER_T_UNSIGNED_BIGINT]: 'BIGINT',
  [MIMER_FLOAT]: 'FLOAT',
  [MIMER_T_FLOAT]: 'FLOAT',
  [MIMER_T_REAL]: 'REAL',
  [MIMER_T_DOUBLE]: 'DOUBLE PRECISION',
  [MIMER_BOOLEAN]: 'BOOLEAN',
  [MIMER_DATE]: 'DATE',
  [MIMER_TIME]: 'TIME',
  [MIMER_TIMESTAMP]: 'TIMESTAMP',
  [MIMER_BINARY]: 'BINARY',
  [MIMER_BINARY_VARYING]: 'BINARY VARYING',
  [MIMER_BLOB]: 'BLOB',
  [MIMER_CLOB]: 'CLOB',
  [MIMER_NCLOB]: 'NCLOB',
  [MIMER_BLOB_LOCATOR]: 'BLOB',
  [MIMER_CLOB_LOCATOR]: 'CLOB',
  [MIMER_NCLOB_LOCATOR]: 'NCLOB',
  [MIMER_NATIVE_SMALLINT]: 'SMALLINT',
  [MIMER_NATIVE_SMALLINT_NULLABLE]: 'SMALLINT',
  [MIMER_NATIVE_INTEGER]: 'INTEGER',
  [MIMER_NATIVE_INTEGER_NULLABLE]: 'INTEGER',
  [MIMER_NATIVE_BIGINT]: 'BIGINT',
  [MIMER_NATIVE_BIGINT_NULLABLE]: 'BIGINT',
  [MIMER_NATIVE_REAL]: 'REAL',
  [MIMER_NATIVE_REAL_NULLABLE]: 'REAL',
  [MIMER_NATIVE_DOUBLE]: 'DOUBLE PRECISION',
  [MIMER_NATIVE_DOUBLE_NULLABLE]: 'DOUBLE PRECISION',
  [MIMER_NATIVE_BLOB]: 'BLOB',
  [MIMER_NATIVE_BLOB_LOCATOR]: 'BLOB',
  [MIMER_NATIVE_CLOB]: 'CLOB',
  [MIMER_NATIVE_CLOB_LOCATOR]: 'CLOB',
  [MIMER_NATIVE_NCLOB]: 'NCLOB',
  [MIMER_NATIVE_NCLOB_LOCATOR]: 'NCLOB',
  [MIMER_UUID]: 'UUID',
};

function mimerTypeName(absType) {
  if (TYPE_NAMES[absType]) return TYPE_NAMES[absType];
  if (absType >= MIMER_INTERVAL_YEAR && absType <= MIMER_INTERVAL_MINUTE_TO_SECOND) {
    return 'INTERVAL';
  }
  return 'UNKNOWN';
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
function throwMimerError(rc, operation, detail) {
  let msg;
  if (detail) {
    msg = `${operation} failed: ${detail} (code: ${rc})`;
  } else {
    msg = `${operation} failed (code: ${rc})`;
  }
  const err = new Error(msg);
  err.mimerCode = rc;
  err.operation = operation;
  throw err;
}

function checkError(session, rc, operation) {
  if (rc < 0) {
    let detail = 'Unknown error';
    if (session) {
      const errCode = [0];
      const errBuf = Buffer.alloc(1024);
      const errRc = MimerGetError8(session, errCode, errBuf, errBuf.length);
      if (errRc > 0) {
        const nullIdx = errBuf.indexOf(0);
        detail = errBuf.toString('utf8', 0, nullIdx >= 0 ? nullIdx : errBuf.length);
      }
    }
    throwMimerError(rc, operation, detail);
  }
}

// ---------------------------------------------------------------------------
// UTF-8 character counting
// ---------------------------------------------------------------------------
function utf8CharCount(buf) {
  let count = 0;
  for (let i = 0; i < buf.length; ) {
    const c = buf[i];
    if (c < 0x80) i += 1;
    else if ((c & 0xe0) === 0xc0) i += 2;
    else if ((c & 0xf0) === 0xe0) i += 3;
    else i += 4;
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helper: build fields array
// ---------------------------------------------------------------------------
function buildFieldsArray(stmt, columnCount) {
  const fields = [];
  for (let col = 1; col <= columnCount; col++) {
    const nameBuf = Buffer.alloc(256);
    MimerColumnName8(stmt, col, nameBuf, nameBuf.length);
    const nullIdx = nameBuf.indexOf(0);
    const name = nameBuf.toString('utf8', 0, nullIdx >= 0 ? nullIdx : nameBuf.length);

    const rawType = MimerColumnType(stmt, col);
    const absType = rawType < 0 ? -rawType : rawType;
    const dataTypeName = mimerTypeName(absType);

    let nullable;
    if (rawType < 0) {
      nullable = true;
    } else if (
      absType === MIMER_NATIVE_SMALLINT_NULLABLE
      || absType === MIMER_NATIVE_INTEGER_NULLABLE
      || absType === MIMER_NATIVE_BIGINT_NULLABLE
      || absType === MIMER_NATIVE_REAL_NULLABLE
      || absType === MIMER_NATIVE_DOUBLE_NULLABLE
    ) {
      nullable = true;
    } else {
      nullable = false;
    }

    fields.push({
      name,
      dataTypeCode: rawType,
      dataTypeName,
      nullable,
    });
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Helper: bind parameters
// ---------------------------------------------------------------------------
function bindParameters(stmt, params, session) {
  const paramCount = MimerParameterCount(stmt);
  if (params.length !== paramCount) {
    throwMimerError(
      0,
      'BindParameters',
      `statement expects ${paramCount} but ${params.length} were provided`
    );
  }

  for (let i = 0; i < params.length; i++) {
    const paramIndex = i + 1; // Mimer is 1-based
    const val = params[i];
    let rc;

    if (val === null || val === undefined) {
      rc = MimerSetNull(stmt, paramIndex);
    } else if (typeof val === 'boolean') {
      rc = MimerSetBoolean(stmt, paramIndex, val ? 1 : 0);
    } else if (typeof val === 'number') {
      if (Number.isFinite(val) && Math.trunc(val) === val) {
        if (val >= -2147483648 && val <= 2147483647) {
          rc = MimerSetInt32(stmt, paramIndex, val);
        } else {
          rc = MimerSetInt64(stmt, paramIndex, val);
        }
      } else {
        rc = MimerSetDouble(stmt, paramIndex, val);
      }
    } else if (typeof val === 'string') {
      const ptype = MimerParameterType(stmt, paramIndex);
      if (mimerIsNclob(ptype)) {
        const buf = Buffer.from(val, 'utf8');
        const charCount = utf8CharCount(buf);
        const lobHandle = [null];
        rc = MimerSetLob(stmt, paramIndex, charCount, lobHandle);
        if (rc === 0) {
          let remaining = buf.length;
          let offset = 0;
          while (remaining > 0 && rc >= 0) {
            let chunk = remaining < LOB_WRITE_CHUNK ? remaining : LOB_WRITE_CHUNK;
            // Don't split multi-byte UTF-8 sequences
            while (chunk > 0 && chunk < remaining && (buf[offset + chunk] & 0xc0) === 0x80) {
              chunk--;
            }
            const chunkBuf = buf.subarray(offset, offset + chunk);
            rc = MimerSetNclobData8(lobHandle, chunkBuf, chunk);
            offset += chunk;
            remaining -= chunk;
          }
        }
      } else {
        rc = MimerSetString8(stmt, paramIndex, val);
      }
    } else if (Buffer.isBuffer(val)) {
      const ptype = MimerParameterType(stmt, paramIndex);
      if (mimerIsBlob(ptype)) {
        const lobHandle = [null];
        rc = MimerSetLob(stmt, paramIndex, val.length, lobHandle);
        if (rc === 0) {
          let remaining = val.length;
          let offset = 0;
          while (remaining > 0 && rc >= 0) {
            const chunk = remaining < LOB_WRITE_CHUNK ? remaining : LOB_WRITE_CHUNK;
            const chunkBuf = val.subarray(offset, offset + chunk);
            rc = MimerSetBlobData(lobHandle, chunkBuf, chunk);
            offset += chunk;
            remaining -= chunk;
          }
        }
      } else {
        rc = MimerSetBinary(stmt, paramIndex, val, val.length);
      }
    } else {
      // Fallback: convert to string
      rc = MimerSetString8(stmt, paramIndex, String(val));
    }

    if (rc < 0) {
      checkError(session, rc, 'BindParameters');
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: fetch a single row
// ---------------------------------------------------------------------------
function fetchSingleRow(stmt, columnCount, colNames, colTypes) {
  const row = {};

  for (let col = 1; col <= columnCount; col++) {
    const colName = colNames[col - 1];
    const colType = colTypes[col - 1];

    if (MimerIsNull(stmt, col) > 0) {
      row[colName] = null;
      continue;
    }

    if (mimerIsInt32(colType)) {
      const val = [0];
      const rc = MimerGetInt32(stmt, col, val);
      if (rc === 0) row[colName] = val[0];
    } else if (mimerIsInt64(colType)) {
      const val = [0n];
      const rc = MimerGetInt64(stmt, col, val);
      if (rc === 0) row[colName] = Number(val[0]);
    } else if (mimerIsDouble(colType)) {
      const val = [0];
      const rc = MimerGetDouble(stmt, col, val);
      if (rc === 0) row[colName] = val[0];
    } else if (mimerIsFloat(colType)) {
      const val = [0];
      const rc = MimerGetFloat(stmt, col, val);
      if (rc === 0) row[colName] = val[0];
    } else if (mimerIsBoolean(colType)) {
      const val = MimerGetBoolean(stmt, col);
      row[colName] = val > 0;
    } else if (mimerIsBlob(colType)) {
      const lobSize = [0];
      const lobHandle = [null];
      const rc = MimerGetLob(stmt, col, lobSize, lobHandle);
      if (rc === 0 && lobSize[0] > 0) {
        const totalSize = lobSize[0];
        const buf = Buffer.alloc(totalSize);
        let offset = 0;
        let remaining = totalSize;
        let readRc = 0;
        while (remaining > 0) {
          const chunk = remaining < LOB_READ_CHUNK ? remaining : LOB_READ_CHUNK;
          const chunkBuf = Buffer.alloc(chunk);
          readRc = MimerGetBlobData(lobHandle, chunkBuf, chunk);
          if (readRc < 0) break;
          chunkBuf.copy(buf, offset);
          offset += chunk;
          remaining -= chunk;
        }
        if (readRc >= 0) row[colName] = buf;
      } else if (rc === 0) {
        row[colName] = Buffer.alloc(0);
      }
    } else if (mimerIsNclob(colType)) {
      const charCount = [0];
      const lobHandle = [null];
      const rc = MimerGetLob(stmt, col, charCount, lobHandle);
      if (rc === 0 && charCount[0] > 0) {
        const parts = [];
        let readRc;
        do {
          const chunkBuf = Buffer.alloc(LOB_READ_CHUNK + 1);
          readRc = MimerGetNclobData8(lobHandle, chunkBuf, chunkBuf.length);
          if (readRc < 0) break;
          const nullIdx = chunkBuf.indexOf(0);
          parts.push(chunkBuf.toString('utf8', 0, nullIdx >= 0 ? nullIdx : chunkBuf.length));
        } while (readRc > 0);
        if (readRc >= 0) row[colName] = parts.join('');
      } else if (rc === 0) {
        row[colName] = '';
      }
    } else if (mimerIsBinary(colType)) {
      const size = MimerGetBinary(stmt, col, null, 0);
      if (size > 0) {
        const buf = Buffer.alloc(size);
        const rc = MimerGetBinary(stmt, col, buf, size);
        if (rc >= 0) row[colName] = buf;
      } else {
        row[colName] = Buffer.alloc(0);
      }
    } else {
      // Default: string (VARCHAR, DATE, TIME, TIMESTAMP, DECIMAL, UUID, etc.)
      // Use a single large buffer instead of a two-call probe pattern.
      // The probe pattern (size-0 call with _Out_ buffer) causes Koffi heap corruption.
      let bufSize = 256;
      let buf = Buffer.alloc(bufSize);
      let size = MimerGetString8(stmt, col, buf, bufSize);
      if (size >= bufSize) {
        // String was truncated — retry with exact size
        bufSize = size + 1;
        buf = Buffer.alloc(bufSize);
        size = MimerGetString8(stmt, col, buf, bufSize);
      }
      if (size > 0) {
        const nullIdx = buf.indexOf(0);
        row[colName] = buf.toString('utf8', 0, nullIdx >= 0 ? nullIdx : buf.length);
      } else {
        row[colName] = '';
      }
    }
  }

  return row;
}

// ---------------------------------------------------------------------------
// Helper: cache column metadata
// ---------------------------------------------------------------------------
function cacheColumnMetadata(stmt, columnCount) {
  const colNames = [];
  const colTypes = [];
  for (let col = 1; col <= columnCount; col++) {
    const nameBuf = Buffer.alloc(256);
    MimerColumnName8(stmt, col, nameBuf, nameBuf.length);
    const nullIdx = nameBuf.indexOf(0);
    colNames.push(nameBuf.toString('utf8', 0, nullIdx >= 0 ? nullIdx : nameBuf.length));
    colTypes.push(MimerColumnType(stmt, col));
  }
  return { colNames, colTypes };
}

// ---------------------------------------------------------------------------
// Helper: fetch all results
// ---------------------------------------------------------------------------
function fetchResults(stmt, columnCount) {
  const { colNames, colTypes } = cacheColumnMetadata(stmt, columnCount);
  const rows = [];
  while (MimerFetch(stmt) === MIMER_SUCCESS) {
    rows.push(fetchSingleRow(stmt, columnCount, colNames, colTypes));
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Connection class
// ---------------------------------------------------------------------------
class Connection {
  constructor() {
    this._session = null;
    this._connected = false;
    this._openStatements = new Set();
    this._openResultSets = new Set();
  }

  connect(dsn, user, password) {
    if (arguments.length < 3) {
      throw new TypeError('Expected 3 arguments: dsn, user, password');
    }
    if (typeof dsn !== 'string' || typeof user !== 'string' || typeof password !== 'string') {
      throw new TypeError('All arguments must be strings');
    }

    const sessionOut = [null];
    const rc = MimerBeginSession8(dsn, user, password, sessionOut);
    if (rc < 0) {
      checkError(null, rc, 'MimerBeginSession8');
    }

    this._session = sessionOut[0];
    this._connected = true;
    return true;
  }

  close() {
    if (!this._connected) return true;

    // Invalidate all open result sets
    for (const rs of this._openResultSets) {
      rs._invalidate();
    }
    this._openResultSets.clear();

    // Invalidate all open statements
    for (const st of this._openStatements) {
      st._invalidate();
    }
    this._openStatements.clear();

    if (this._session !== null) {
      const sessionRef = [this._session];
      const rc = MimerEndSession(sessionRef);
      if (rc < 0) {
        checkError(this._session, rc, 'MimerEndSession');
      }
      this._session = null;
      this._connected = false;
    }

    return true;
  }

  execute(sql, params) {
    if (!this._connected) {
      throw new Error('Not connected to database');
    }
    if (typeof sql !== 'string') {
      throw new TypeError('Expected SQL string as first argument');
    }

    const hasParams = Array.isArray(params) && params.length > 0;

    // Try to prepare the statement
    const stmtOut = [null];
    let rc = MimerBeginStatement8(this._session, sql, MIMER_FORWARD_ONLY, stmtOut);

    // DDL statements cannot be prepared — execute directly
    if (rc === MIMER_STATEMENT_CANNOT_BE_PREPARED) {
      rc = MimerExecuteStatement8(this._session, sql);
      if (rc < 0) {
        checkError(this._session, rc, 'MimerExecuteStatement8');
      }
      return { rowCount: 0 };
    }

    if (rc < 0) {
      checkError(this._session, rc, 'MimerBeginStatement8');
    }

    const stmt = stmtOut[0];

    try {
      // Bind parameters if provided
      if (hasParams) {
        bindParameters(stmt, params, this._session);
      }

      const columnCount = MimerColumnCount(stmt);
      const hasResultSet = columnCount > 0;
      const result = {};

      if (hasResultSet) {
        result.fields = buildFieldsArray(stmt, columnCount);

        rc = MimerOpenCursor(stmt);
        if (rc < 0) {
          checkError(this._session, rc, 'MimerOpenCursor');
        }

        const rows = fetchResults(stmt, columnCount);
        result.rows = rows;
        result.rowCount = rows.length;
      } else {
        rc = MimerExecute(stmt);
        if (rc < 0) {
          checkError(this._session, rc, 'MimerExecute');
        }
        result.rowCount = rc;
      }

      return result;
    } finally {
      const stmtRef = [stmt];
      MimerEndStatement(stmtRef);
    }
  }

  beginTransaction() {
    if (!this._connected) {
      throw new Error('Not connected to database');
    }
    const rc = MimerBeginTransaction(this._session, MIMER_TRANS_READWRITE);
    if (rc < 0) {
      checkError(this._session, rc, 'MimerBeginTransaction');
    }
    return true;
  }

  commit() {
    if (!this._connected) {
      throw new Error('Not connected to database');
    }
    const rc = MimerEndTransaction(this._session, MIMER_COMMIT);
    if (rc < 0) {
      checkError(this._session, rc, 'MimerEndTransaction (commit)');
    }
    return true;
  }

  rollback() {
    if (!this._connected) {
      throw new Error('Not connected to database');
    }
    const rc = MimerEndTransaction(this._session, MIMER_ROLLBACK);
    if (rc < 0) {
      checkError(this._session, rc, 'MimerEndTransaction (rollback)');
    }
    return true;
  }

  isConnected() {
    return this._connected;
  }

  prepare(sql) {
    if (!this._connected) {
      throw new Error('Not connected to database');
    }
    if (typeof sql !== 'string') {
      throw new TypeError('Expected SQL string as first argument');
    }

    const st = new Statement(this._session, sql, this);
    this._openStatements.add(st);
    return st;
  }

  executeQuery(sql, params) {
    if (!this._connected) {
      throw new Error('Not connected to database');
    }
    if (typeof sql !== 'string') {
      throw new TypeError('Expected SQL string as first argument');
    }

    const hasParams = Array.isArray(params) && params.length > 0;

    const stmtOut = [null];
    let rc = MimerBeginStatement8(this._session, sql, MIMER_FORWARD_ONLY, stmtOut);

    if (rc === MIMER_STATEMENT_CANNOT_BE_PREPARED) {
      throw new Error('queryCursor only supports SELECT statements (DDL cannot be prepared)');
    }
    if (rc < 0) {
      checkError(this._session, rc, 'MimerBeginStatement8');
    }

    const stmt = stmtOut[0];

    if (hasParams) {
      try {
        bindParameters(stmt, params, this._session);
      } catch (e) {
        const stmtRef = [stmt];
        MimerEndStatement(stmtRef);
        throw e;
      }
    }

    const columnCount = MimerColumnCount(stmt);
    if (columnCount <= 0) {
      const stmtRef = [stmt];
      MimerEndStatement(stmtRef);
      throw new Error('queryCursor only supports SELECT statements (DML has no result columns)');
    }

    rc = MimerOpenCursor(stmt);
    if (rc < 0) {
      const stmtRef = [stmt];
      MimerEndStatement(stmtRef);
      checkError(this._session, rc, 'MimerOpenCursor');
    }

    const rs = new ResultSet(stmt, columnCount, this);
    this._openResultSets.add(rs);
    return rs;
  }

  _unregisterStatement(st) {
    this._openStatements.delete(st);
  }

  _unregisterResultSet(rs) {
    this._openResultSets.delete(rs);
  }
}

// ---------------------------------------------------------------------------
// Statement class
// ---------------------------------------------------------------------------
class Statement {
  constructor(session, sql, parentConnection) {
    this._session = session;
    this._parentConnection = parentConnection;
    this._closed = false;

    const stmtOut = [null];
    const rc = MimerBeginStatement8(session, sql, MIMER_FORWARD_ONLY, stmtOut);
    if (rc < 0) {
      throwMimerError(rc, 'MimerBeginStatement8');
    }
    this._stmt = stmtOut[0];
    this._columnCount = MimerColumnCount(this._stmt);
  }

  execute(params) {
    if (this._closed) {
      throw new Error('Statement is closed');
    }

    if (Array.isArray(params) && params.length > 0) {
      bindParameters(this._stmt, params, this._session);
    }

    const hasResultSet = this._columnCount > 0;
    const result = {};

    if (hasResultSet) {
      result.fields = buildFieldsArray(this._stmt, this._columnCount);

      const rc = MimerOpenCursor(this._stmt);
      if (rc < 0) {
        throwMimerError(rc, 'MimerOpenCursor');
      }

      const rows = fetchResults(this._stmt, this._columnCount);
      MimerCloseCursor(this._stmt);

      result.rows = rows;
      result.rowCount = rows.length;
    } else {
      const rc = MimerExecute(this._stmt);
      if (rc < 0) {
        throwMimerError(rc, 'MimerExecute');
      }
      result.rowCount = rc;
    }

    return result;
  }

  close() {
    this._closeInternal();
    return true;
  }

  _closeInternal() {
    if (!this._closed && this._stmt) {
      const stmtRef = [this._stmt];
      MimerEndStatement(stmtRef);
    }
    this._closed = true;
    if (this._parentConnection) {
      this._parentConnection._unregisterStatement(this);
      this._parentConnection = null;
    }
  }

  _invalidate() {
    if (!this._closed && this._stmt) {
      const stmtRef = [this._stmt];
      MimerEndStatement(stmtRef);
    }
    this._closed = true;
    this._parentConnection = null;
  }
}

// ---------------------------------------------------------------------------
// ResultSet class
// ---------------------------------------------------------------------------
class ResultSet {
  constructor(stmt, columnCount, parentConnection) {
    this._stmt = stmt;
    this._columnCount = columnCount;
    this._parentConnection = parentConnection;
    this._closed = false;
    this._exhausted = false;

    const meta = cacheColumnMetadata(stmt, columnCount);
    this._colNames = meta.colNames;
    this._colTypes = meta.colTypes;
  }

  fetchNext() {
    if (this._closed || this._exhausted) {
      return null;
    }

    const rc = MimerFetch(this._stmt);
    if (rc === MIMER_SUCCESS) {
      return fetchSingleRow(this._stmt, this._columnCount, this._colNames, this._colTypes);
    }

    this._exhausted = true;
    return null;
  }

  getFields() {
    if (this._closed) return [];
    return buildFieldsArray(this._stmt, this._columnCount);
  }

  close() {
    this._closeInternal();
    return true;
  }

  isClosed() {
    return this._closed;
  }

  _closeInternal() {
    if (!this._closed && this._stmt) {
      MimerCloseCursor(this._stmt);
      const stmtRef = [this._stmt];
      MimerEndStatement(stmtRef);
    }
    this._closed = true;
    if (this._parentConnection) {
      this._parentConnection._unregisterResultSet(this);
      this._parentConnection = null;
    }
  }

  _invalidate() {
    if (!this._closed && this._stmt) {
      MimerCloseCursor(this._stmt);
      const stmtRef = [this._stmt];
      MimerEndStatement(stmtRef);
    }
    this._closed = true;
    this._parentConnection = null;
  }
}

// ---------------------------------------------------------------------------
// Module exports (same shape as the C++ addon)
// ---------------------------------------------------------------------------
module.exports = {
  Connection,
  Statement,
  ResultSet,
  version: '1.0.0',
};
