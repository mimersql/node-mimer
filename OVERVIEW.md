# node-mimer - Project Overview

Node.js bindings for Mimer SQL using a C++ native addon (Node-API) to call the
Mimer SQL C API. Prebuilt binaries are shipped for supported platforms.

## Architecture

```
            ┌────────────────────────────┐
            │   Application (JavaScript) │
            └────────────┬───────────────┘
                         │
                         │ require('@mimersql/node-mimer')
                         ▼
            ┌────────────────────────────┐
            │   node-mimer (JavaScript)  │
            │   index.js                 │
            │   - MimerClient            │
            │   - Promise-based API      │
            └────────────┬───────────────┘
                         │ lib/native.js
                         ▼
            ┌────────────────────────────┐
            │   C++ Native Addon         │
            │   src/connection.cc        │
            │   src/statement.cc         │
            │   src/resultset.cc         │
            │   src/helpers.cc           │
            └────────────┬───────────────┘
                         │ C API calls
                         ▼
            ┌────────────────────────────┐
            │      Mimer SQL C API       │
            │      libmimerapi.so        │
            └────────────┬───────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │   Mimer SQL Database       │
            └────────────────────────────┘
```

Prebuilt `.node` binaries are shipped in the npm package for supported platforms.
At install time, `prebuild-install` loads the matching binary. If no prebuilt is
available, the addon is compiled from source using `node-gyp`.

## Component Description

### Layer 1: Mimer SQL C API
Native C library included with the Mimer SQL installation.

**Key functions:**
- `MimerBeginSession8()` - Connect to database
- `MimerEndSession()` - Close connection
- `MimerBeginStatement8()` / `MimerExecuteStatement8()` - Execute SQL
- `MimerOpenCursor()` / `MimerFetch()` - Fetch results
- `MimerColumnCount()`, `MimerColumnName8()`, `MimerColumnType()` - Column metadata
- `MimerGetString8()`, `MimerGetInt32()`, etc. - Read column values
- `MimerSetString8()`, `MimerSetInt32()`, etc. - Bind parameters
- `MimerBeginTransaction()` / `MimerEndTransaction()` - Transaction control
- `MimerGetError8()` - Error handling
- `MimerGetLob()` / `MimerGetBlobData()` / `MimerGetNclobData8()` - LOB reading
- `MimerSetLob()` / `MimerSetBlobData()` / `MimerSetNclobData8()` - LOB writing

### Layer 2: C++ Native Addon (Node-API)
C++ addon that calls the Mimer SQL C API directly. Uses
[Node-API](https://nodejs.org/api/n-api.html) (N-API v8) for ABI stability
across Node.js versions.

**Source files:**
- `src/mimer_addon.cc` - Module entry point
- `src/connection.cc/h` - Connection class
- `src/statement.cc/h` - Prepared statement class
- `src/resultset.cc/h` - Cursor/streaming result set class
- `src/helpers.cc/h` - Parameter binding, row fetching, error handling

**Build configuration:**
- `binding.gyp` - Node-gyp build config (platform-specific linking)
- `scripts/find-mimer-windows.js` - Auto-detect Mimer SQL installation on Windows

**Exported classes:**
```javascript
class Connection {
  connect(dsn, user, password);    // Connect
  execute(sql, params);            // Execute query with optional params
  prepare(sql);                    // Create prepared statement
  executeQuery(sql, params);       // Open cursor for streaming results
  beginTransaction();              // Start explicit transaction
  commit() / rollback();           // End transaction
  close();                         // Close connection
  isConnected();                   // Check connection state
}

class Statement {
  execute(params);                 // Execute with params, reusable
  close();                         // Release statement handle
}

class ResultSet {
  fetchNext();                     // Fetch one row, or null at end
  getFields();                     // Column metadata array
  close();                         // Close cursor and release handle
  isClosed();                      // Check if cursor is closed
}
```

### Layer 3: JavaScript Wrapper (Node.js)
Promise-based JavaScript API that wraps the binding layer.

**Files:** `index.js` (re-exports), `lib/client.js`, `lib/prepared.js`, `lib/resultset.js`, `lib/pool.js`

**Classes:** `MimerClient`, `PreparedStatement`, `ResultSet`, `Pool`, `PoolClient`

```javascript
const client = new MimerClient();
await client.connect({ dsn, user, password });

// Simple query
const result = await client.query('SELECT ...');

// Parameterized query
await client.query('INSERT INTO t VALUES (?, ?)', [1, 'hello']);

// Prepared statement (reusable)
const stmt = await client.prepare('SELECT * FROM t WHERE id = ?');
const r1 = await stmt.execute([1]);
const r2 = await stmt.execute([2]);
await stmt.close();

// Cursor for streaming large result sets
const cursor = await client.queryCursor('SELECT * FROM big_table');
for await (const row of cursor) {
  process(row);
}

await client.commit();
await client.close();
```

**Connection Pool:**
```javascript
const { createPool } = require('@mimersql/node-mimer');

const pool = createPool({ dsn, user, password, max: 10 });

// Auto-acquire/release
const result = await pool.query('SELECT * FROM t');

// Explicit checkout for transactions
const client = await pool.connect();
await client.beginTransaction();
await client.query('INSERT INTO t VALUES (?)', [1]);
await client.commit();
client.release();

await pool.end();
```

## Binary Distribution

`lib/native.js` uses [node-gyp-build](https://github.com/prebuild/node-gyp-build)
to load the native addon:

1. Prebuilt binary from `prebuilds/<platform>-<arch>/` (shipped in the npm package)
2. Dev build from `build/Release/` (compiled locally via `node-gyp rebuild`)

The install script (`prebuild-install || node-gyp rebuild`) ensures a binary is
available after `npm install`.

## Installation

```bash
npm install @mimersql/node-mimer
```

Prebuilt binaries are included for supported platforms. On other platforms, the
addon is compiled from source (requires a C++ compiler and Mimer SQL development
headers). The Mimer SQL client runtime (`libmimerapi.so` / `libmimerapi.dylib` /
`mimapi64.dll`) must be installed on the system.

## File Structure

```
node-mimer/
├── src/                          # C++ native addon
│   ├── mimer_addon.cc           # Module entry point
│   ├── connection.cc/h          # Connection class
│   ├── statement.cc/h           # Prepared statement class
│   ├── resultset.cc/h           # Cursor/streaming result set class
│   └── helpers.cc/h             # Parameter binding, row fetching, errors
│
├── lib/                          # JavaScript source
│   ├── native.js                # Loads native addon via node-gyp-build
│   ├── client.js                # MimerClient, connect()
│   ├── prepared.js              # PreparedStatement
│   ├── resultset.js             # ResultSet (cursor wrapper)
│   └── pool.js                  # Pool, PoolClient
│
├── prebuilds/                    # Prebuilt binaries (per platform)
│   └── linux-x64/               # Example: Linux x64 binary
│
├── scripts/
│   ├── check-mimer.js           # Verify Mimer installation
│   └── find-mimer-windows.js    # Auto-detect Mimer on Windows
│
├── binding.gyp                   # Native addon build configuration
├── index.js                      # Re-exports from lib/
├── index.d.ts                    # TypeScript type definitions
├── package.json                  # npm configuration
├── README.md                     # User documentation
│
└── test/
    ├── helper.js                # Shared test utilities
    ├── *.test.js                # Test suites (node:test)
    └── test.js                  # Legacy usage example
```

## Key Design Decisions

### 1. C++ Native Addon with Prebuilt Binaries
- **Node-API (N-API v8)** — ABI-stable across Node.js versions, no recompilation needed
- **Prebuilt binaries** — shipped in the npm package for supported platforms (~200KB compressed)
- **Fallback compilation** — `node-gyp rebuild` if no prebuilt is available
- **Direct C API access** — calls `libmimerapi` functions directly from C++

### 2. Promise-based API
- Modern JavaScript idiom
- Simpler error handling
- Works well with async/await

### 3. Statement Execution Strategy
- **DDL statements** (CREATE, DROP, ALTER) are executed directly via `MimerExecuteStatement8` since they cannot be prepared
- **DML and queries** use `MimerBeginStatement8` for preparation, then `MimerOpenCursor`/`MimerFetch` for SELECT or `MimerExecute` for INSERT/UPDATE/DELETE
- Column type detection uses ported Mimer helper macros (`mimerIsInt32`, `mimerIsString`, etc.)

### 4. Transaction Model
- By default, each DML statement auto-commits
- Explicit transactions are started with `MimerBeginTransaction` and ended with `MimerEndTransaction`
- DDL statements always auto-commit regardless of transaction state

## Data Type Mapping

| Mimer SQL       | C++ Type     | JavaScript |
|-----------------|--------------|------------|
| INTEGER         | int32_t      | Number     |
| BIGINT          | int64_t      | Number     |
| FLOAT/DOUBLE    | double       | Number     |
| REAL            | float        | Number     |
| VARCHAR/NVARCHAR| char*        | String     |
| BINARY/VARBINARY| uint8_t*     | Buffer     |
| BOOLEAN         | int32_t      | Boolean    |
| DATE/TIME/TIMESTAMP | char*    | String     |
| BLOB            | chunked read | Buffer     |
| NCLOB           | chunked read | String     |
| UUID            | char*        | String     |

## Result Metadata

SELECT queries include a `fields` array with column metadata, built from
`MimerColumnName8` and `MimerColumnType` before row fetching begins. This
means metadata is available even when a query returns zero rows.

```javascript
const result = await client.query('SELECT id, name FROM users WHERE 1 = 0');
// result.rowCount === 0
// result.fields === [
//   { name: 'id',   dataTypeCode: 50, dataTypeName: 'INTEGER', nullable: true },
//   { name: 'name', dataTypeCode: 63, dataTypeName: 'NVARCHAR',    nullable: false }
// ]
```

**Nullability detection** uses two Mimer conventions:
- Non-native types: a negative `dataTypeCode` means nullable
- Native types: explicit `_NULLABLE` variant codes (e.g. `MIMER_NATIVE_INTEGER_NULLABLE` = 50 vs `MIMER_NATIVE_INTEGER` = 49)

The `dataTypeName` is resolved by `mimerTypeName()` in the native addon, mapping
~40 Mimer type constants to standard SQL type names.

DML results (INSERT/UPDATE/DELETE) only contain `rowCount` — no `fields`.

## Error Handling

Errors propagate through all layers as structured JavaScript `Error` objects:

```
Mimer SQL C API Error
    ↓ (MimerGetError8)
CheckError() in helpers.cc
    ↓ (Napi::Error with mimerCode + operation properties)
JavaScript Exception
    ↓ (Promise rejection)
Application Error Handler
```

Every error thrown by a Mimer C API call includes:

| Property | Type | Description |
|----------|------|-------------|
| `message` | string | Human-readable error description |
| `mimerCode` | number | Numeric Mimer error code (e.g. `-12200`) |
| `operation` | string | The C API function that failed (e.g. `"MimerOpenCursor"`) |

```javascript
try {
  await client.query('SELECT * FROM nonexistent');
} catch (err) {
  console.log(err.message);   // "MimerOpenCursor failed: ... (code: -12200)"
  console.log(err.mimerCode);  // -12200
  console.log(err.operation);  // "MimerOpenCursor"
}
```

## Cursor / Streaming Results

`queryCursor()` opens a server-side cursor and returns a `ResultSet` that
fetches rows one at a time, keeping memory usage constant regardless of result
set size.

### How it works

```
client.queryCursor(sql, params)
    → Connection.executeQuery()
        → MimerBeginStatement8  (prepare)
        → bindParameters        (if params)
        → MimerOpenCursor       (open cursor)
        → create ResultSet      (owns the stmt handle)

cursor.next()
    → ResultSet.fetchNext()
        → MimerFetch            (advance cursor one row)
        → fetchSingleRow        (read column values)
        → return JS object (or null at end)

cursor.close()
    → ResultSet.close()
        → MimerCloseCursor
        → MimerEndStatement
```

### JavaScript API

```javascript
// Async iteration (recommended)
const cursor = await client.queryCursor('SELECT * FROM t WHERE x > ?', [100]);
for await (const row of cursor) {
  process(row);
  if (done) break;  // triggers cursor.close() automatically
}

// Manual iteration
const cursor = await client.queryCursor('SELECT * FROM t');
console.log(cursor.fields);  // column metadata
let row;
while ((row = await cursor.next()) !== null) {
  process(row);
}
// auto-closed when exhausted, or call cursor.close() to stop early
```

Only SELECT statements are accepted — DDL and DML are rejected with an error.

## Testing

Tests use the Node.js built-in test runner (`node:test`) with `describe`/`it`
blocks and `assert/strict`. Each test file covers one area and uses isolated
table names to avoid collisions when files run in sequence.

```
test/
  helper.js                        # createClient(), dropTable()
  connection.test.js               # Connect, isConnected, close
  basic-queries.test.js            # DDL, DML, SELECT
  transactions.test.js             # beginTransaction, commit, rollback
  result-metadata.test.js          # fields array, properties, edge cases
  unicode.test.js                  # NVARCHAR round-trip, Unicode WHERE
  parameterized-queries.test.js    # ? params, types, NULL, mismatch error
  prepared-statements.test.js      # prepare/execute/close lifecycle
  cursor.test.js                   # queryCursor, for-await-of, early break
  error-handling.test.js           # Structured errors (mimerCode, operation)
  pool.test.js                     # Connection pool, PoolClient, auto-release
  test.js                          # Legacy usage example (not run by npm test)
```

```bash
# Run all tests (requires a running Mimer SQL instance)
npm test

# Run a single test file
node --test test/unicode.test.js
```

## Troubleshooting

### Runtime Errors

**Problem:** "Cannot find libmimerapi.so" or similar library loading error
- Make sure Mimer SQL client runtime is installed
- Linux: `ls /usr/lib/libmimerapi.so*`
- macOS: `ls /usr/local/lib/libmimerapi.dylib`
- Windows: Verify Mimer SQL installation and that `mimapi64.dll` is accessible

**Problem:** "Cannot connect to database"
- Verify Mimer SQL is running
- Check DSN, user, password
- Test with `bsql` first

## License

MIT License

## Support and Documentation

- **Mimer SQL Docs:** https://developer.mimer.com/documentation
- **Mimer SQL C API Reference:** https://developer.mimer.com/mimerapi
- **Node-API:** https://nodejs.org/api/n-api.html
