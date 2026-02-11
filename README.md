# node-mimer

Node.js driver for Mimer SQL using the Mimer SQL C API.

## Features

- Direct bindings to the Mimer SQL C API via [Koffi](https://koffi.dev/) FFI - no ODBC required
- Pure JavaScript - no C++ compiler needed at install time
- Promise-based API
- Parameterized queries with `?` placeholders (SQL injection safe)
- Prepared statements for repeated execution
- Result metadata with column names, types, and nullability
- Support for all major Mimer SQL data types (including BLOB, NCLOB, UUID)
- Transaction support (commit/rollback)
- Structured error objects with Mimer error codes
- Cursor support for streaming large result sets (`for await`)
- Connection pooling with automatic acquire/release

## Prerequisites

- Node.js 18.0 or later
- Mimer SQL 11.0 or later installed (the `libmimerapi` shared library must be available)

No C++ compiler is required. The package uses Koffi FFI to call the Mimer SQL C API
directly from JavaScript.

## Installation

```bash
npm install @mimersql/node-mimer
```

That's it. No native compilation, no prebuilt binaries to download.

### Verifying Mimer SQL is found

```bash
npm run check-mimer
```

### Platform-specific library locations

**Linux:** `libmimerapi.so` (found via the standard library search path)

**macOS:** `/usr/local/lib/libmimerapi.dylib`

**Windows:** Automatically detected via `MIMER_HOME` environment variable,
Windows Registry, or Program Files scan (highest version wins).

## Usage

### Basic Example

```javascript
const { connect } = require('@mimersql/node-mimer');

async function example() {
  // Connect to database
  const client = await connect({
    dsn: 'mydb',
    user: 'SYSADM',
    password: 'password'
  });

  // Execute a query
  const result = await client.query('SELECT * FROM my_table');
  console.log(result.rows);

  // Close connection
  await client.close();
}

example();
```

### Using Transactions

```javascript
const { MimerClient } = require('@mimersql/node-mimer');

async function transactionExample() {
  const client = new MimerClient();

  try {
    await client.connect({
      dsn: 'mydb',
      user: 'SYSADM',
      password: 'password'
    });

    // Start transaction
    await client.beginTransaction();

    // Execute multiple statements
    await client.query("INSERT INTO accounts VALUES (1, 1000)");
    await client.query("INSERT INTO accounts VALUES (2, 500)");

    // Commit transaction
    await client.commit();

  } catch (error) {
    // Rollback on error
    await client.rollback();
    throw error;
  } finally {
    await client.close();
  }
}
```

### Parameterized Queries

Use `?` placeholders to pass parameters safely. This prevents SQL injection and
lets the database optimize execution.

```javascript
// INSERT with parameters
await client.query('INSERT INTO users VALUES (?, ?)', [1, 'Anna']);

// SELECT with a WHERE parameter
const result = await client.query(
  'SELECT * FROM users WHERE id = ?', [1]
);

// Multiple types are supported
await client.query(
  'INSERT INTO readings VALUES (?, ?, ?, ?)',
  [42, 'sensor-1', 3.14, true]
);

// NULL values
await client.query(
  'INSERT INTO users VALUES (?, ?)', [2, null]
);
```

Parameter types are mapped automatically:

| JavaScript type | Mimer SQL binding |
|-----------------|-------------------|
| `number` (integer) | `INTEGER` or `BIGINT` |
| `number` (decimal) | `DOUBLE PRECISION` |
| `string` | `VARCHAR` / `NVARCHAR` |
| `boolean` | `BOOLEAN` |
| `null` / `undefined` | `NULL` |
| `Buffer` | `BINARY` / `BLOB` |

### Prepared Statements

For statements executed multiple times with different parameters, prepared
statements avoid re-parsing the SQL on each call.

```javascript
// Prepare once
const stmt = await client.prepare('INSERT INTO users VALUES (?, ?)');

// Execute many times with different parameters
await stmt.execute([1, 'Anna']);
await stmt.execute([2, 'Fredrik']);
await stmt.execute([3, 'Charlie']);

// Always close when done to release database resources
await stmt.close();
```

Prepared SELECT statements work the same way:

```javascript
const stmt = await client.prepare(
  'SELECT * FROM users WHERE id = ?'
);

const r1 = await stmt.execute([1]);
console.log(r1.rows); // [{ id: 1, name: 'Anna' }]

const r2 = await stmt.execute([2]);
console.log(r2.rows); // [{ id: 2, name: 'Fredrik' }]

await stmt.close();
```

### Cursors (Streaming Large Result Sets)

For large result sets, `queryCursor()` returns a cursor that fetches rows one
at a time instead of loading everything into memory. The cursor implements the
async iterator protocol, so you can use `for await...of`.

```javascript
const cursor = await client.queryCursor('SELECT * FROM big_table');

for await (const row of cursor) {
  console.log(row);
  if (someDoneCondition) break;  // early exit closes the cursor automatically
}
```

You can also iterate manually with `next()` and `close()`:

```javascript
const cursor = await client.queryCursor(
  'SELECT * FROM orders WHERE status = ?', ['pending']
);

// Column metadata is available immediately
console.log(cursor.fields);
// [{ name: 'id', dataTypeCode: 50, dataTypeName: 'INTEGER', nullable: true }, ...]

let row;
while ((row = await cursor.next()) !== null) {
  process(row);
}
// cursor closes automatically when exhausted, or call cursor.close() to stop early
```

`queryCursor()` only accepts SELECT statements. DDL and DML statements are
rejected with an error.

### Connection Pool

For applications that need concurrent database access, the connection pool
manages a set of reusable connections — lending them out on demand and returning
them when done.

```javascript
const { createPool } = require('@mimersql/node-mimer');

const pool = createPool({
  dsn: 'mydb',
  user: 'SYSADM',
  password: 'password',
  max: 10,               // maximum connections (default 10)
  idleTimeout: 30000,    // ms before idle connection is closed (default 30s)
  acquireTimeout: 5000,  // ms to wait for a connection (default 5s)
});

// Convenience — auto-acquires and releases a connection
const result = await pool.query('SELECT * FROM t WHERE id = ?', [1]);

// Cursor — connection held until cursor closes
const cursor = await pool.queryCursor('SELECT * FROM big_table');
for await (const row of cursor) { ... }
// connection auto-released when cursor closes or exhausts

// Explicit checkout — for transactions or multiple operations
const client = await pool.connect();
try {
  await client.beginTransaction();
  await client.query('INSERT INTO t VALUES (?, ?)', [1, 'a']);
  await client.commit();
} finally {
  client.release();   // return to pool (NOT client.close())
}

// Shutdown — closes all connections
await pool.end();
```

### Result Metadata

SELECT queries return a `fields` array with column metadata alongside `rows`.
This is available even when the query returns zero rows, letting you discover
column names and types without needing actual data.

```javascript
const result = await client.query('SELECT id, name FROM users');

console.log(result.fields);
// [
//   { name: 'id',   dataTypeCode: 50, dataTypeName: 'INTEGER', nullable: true },
//   { name: 'name', dataTypeCode: 63, dataTypeName: 'NVARCHAR',    nullable: false }
// ]

console.log(result.rows);
// [{ id: 1, name: 'Anna' }, ...]
```

Each field object contains:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Column name |
| `dataTypeCode` | number | Numeric Mimer type code |
| `dataTypeName` | string | Human-readable SQL type (`INTEGER`, `DOUBLE PRECISION`, `BOOLEAN`, etc.) |
| `nullable` | boolean | Whether the column allows NULL values |

Zero-row results still include full metadata:

```javascript
const result = await client.query('SELECT * FROM users WHERE 1 = 0');
console.log(result.rowCount);       // 0
console.log(result.fields.length);  // 2 — column info is still available
console.log(result.fields[0].name); // 'id'
```

DML statements (INSERT, UPDATE, DELETE) do not return `fields` — only
`rowCount`.

Prepared statements also return `fields` on each `execute()`:

```javascript
const stmt = await client.prepare('SELECT * FROM users WHERE id = ?');
const result = await stmt.execute([1]);
console.log(result.fields[0].dataTypeName); // 'INTEGER'
await stmt.close();
```

### Error Handling

All errors from the Mimer SQL C API are thrown as JavaScript `Error` objects
with structured properties:

```javascript
try {
  await client.query('INSERT INTO nonexistent VALUES (1)');
} catch (err) {
  console.log(err.message);   // Human-readable description
  console.log(err.mimerCode);  // Numeric Mimer error code (e.g. -12200)
  console.log(err.operation);  // C API function that failed (e.g. "MimerExecute")
}
```

This lets you handle specific error conditions programmatically:

```javascript
try {
  await client.query('CREATE TABLE t1 (id INTEGER)');
} catch (err) {
  if (err.mimerCode === -12517) {
    // Table already exists — ignore
  } else {
    throw err;
  }
}
```

Parameter binding errors also include structured properties:

```javascript
try {
  // Wrong number of parameters
  await client.query('INSERT INTO users VALUES (?, ?)', [1]);
} catch (err) {
  console.log(err.mimerCode);  // 0 (validation error, not from Mimer API)
  console.log(err.operation);  // "BindParameters"
}
```

### Data Type Mapping

| Mimer SQL Type | JavaScript Type |
|----------------|-----------------|
| INTEGER, SMALLINT | Number |
| BIGINT | Number |
| FLOAT, REAL, DOUBLE | Number |
| VARCHAR, NVARCHAR | String |
| CHARACTER, NCHAR | String |
| DATE, TIME, TIMESTAMP | String |
| DECIMAL, NUMERIC | String |
| UUID | String |
| BINARY, VARBINARY | Buffer |
| BLOB | Buffer |
| CLOB, NCLOB | String |
| BOOLEAN | Boolean |
| NULL | null |

## Backend Selection

By default, `node-mimer` uses the Koffi FFI backend (pure JavaScript).

If the optional [`@mimersql/node-mimer-native`](https://github.com/mimersql/node-mimer-native)
package is installed, it will be used instead. This can be useful as a fallback
if Koffi is ever unavailable for a given platform.

You can force a specific backend with the `NODE_MIMER_BACKEND` environment variable:

```bash
# Force Koffi FFI (default)
NODE_MIMER_BACKEND=koffi npm test

# Force native C++ addon (requires @mimersql/node-mimer-native)
NODE_MIMER_BACKEND=native npm test
```

## API Reference

### MimerClient

#### `async connect(options)`

Connect to a Mimer SQL database.

**Parameters:**
- `options.dsn` (string): Database name
- `options.user` (string): Username
- `options.password` (string): Password

#### `async query(sql, params)`

Execute a SQL statement with optional parameter binding.

**Parameters:**
- `sql` (string): SQL statement, may contain `?` placeholders
- `params` (array, optional): Values to bind to `?` placeholders

**Returns:** Result object:
- For SELECT: `{ rows, rowCount, fields }` — `fields` is an array of column metadata
- For DML (INSERT/UPDATE/DELETE): `{ rowCount }`
- For DDL (CREATE/DROP/ALTER): `{ rowCount: 0 }`

#### `async prepare(sql)`

Prepare a SQL statement for repeated execution.

**Parameters:**
- `sql` (string): SQL statement with `?` placeholders

**Returns:** `PreparedStatement` instance

### PreparedStatement

#### `async execute(params)`

Execute the prepared statement with parameter values.

**Parameters:**
- `params` (array, optional): Values to bind to `?` placeholders

**Returns:** Result object:
- For SELECT statements: `{ rows, rowCount, fields }`
- For DML statements: `{ rowCount }`

#### `async close()`

Close the prepared statement and release its database resources. The statement
cannot be used after calling `close()`.

#### `async queryCursor(sql, params)`

Execute a SELECT query and return a cursor for row-at-a-time streaming.

**Parameters:**
- `sql` (string): SELECT statement, may contain `?` placeholders
- `params` (array, optional): Values to bind to `?` placeholders

**Returns:** `ResultSet` instance

**Throws:** Error if `sql` is a DDL or DML statement.

### ResultSet

Returned by `queryCursor()`. Fetches rows one at a time from an open
database cursor. Implements `Symbol.asyncIterator` for `for await...of`.

#### `fields`

Column metadata array (same format as `query()` results). Available
immediately after creation.

#### `async next()`

Fetch the next row as a plain object, or `null` when all rows have been read.
The cursor closes automatically when exhausted.

#### `async close()`

Close the cursor and release database resources. Safe to call multiple times.
Called automatically when `for await...of` ends or `break`s.

#### `async beginTransaction()`

Begin a new transaction.

#### `async commit()`

Commit the current transaction.

#### `async rollback()`

Rollback the current transaction.

#### `async close()`

Close the database connection.

#### `isConnected()`

Check if connected to database.

**Returns:** boolean

### Pool

#### `createPool(options)`

Create a new connection pool.

**Parameters:**
- `options.dsn` (string): Database name
- `options.user` (string): Username
- `options.password` (string): Password
- `options.max` (number, optional): Maximum connections (default 10)
- `options.idleTimeout` (number, optional): Ms before idle connection is closed (default 30000)
- `options.acquireTimeout` (number, optional): Ms to wait for a connection (default 5000)

**Returns:** `Pool` instance

#### `async pool.query(sql, params)`

Acquire a connection, execute the query, and release the connection.

**Returns:** Result object (same as `MimerClient.query()`)

#### `async pool.queryCursor(sql, params)`

Acquire a connection and open a cursor. The connection is automatically
released when the cursor closes or is exhausted.

**Returns:** `ResultSet` instance

#### `async pool.connect()`

Check out a connection for multiple operations (e.g. transactions).

**Returns:** `PoolClient` instance

#### `async pool.end()`

Close all idle connections and reject pending waiters. Operations after
`end()` will reject with an error.

### PoolClient

Returned by `pool.connect()`. Delegates `query()`, `queryCursor()`,
`prepare()`, `beginTransaction()`, `commit()`, and `rollback()` to the
underlying `MimerClient`.

#### `release()`

Return the connection to the pool. Always call this instead of `close()`.
Safe to call multiple times.

### Helper Functions

#### `async connect(options)`

Create and connect a new MimerClient instance.

**Returns:** Connected MimerClient instance

## Testing

Tests use the Node.js built-in test runner (`node:test`) and are split into
focused files by category:

```
test/
  helper.js                        # Shared utilities (createClient, dropTable)
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
```

```bash
# Run all tests (requires a running Mimer SQL instance)
npm test

# Run a single test file
node --test test/unicode.test.js

# Test with a specific backend
NODE_MIMER_BACKEND=koffi npm test
NODE_MIMER_BACKEND=native npm test   # requires @mimersql/node-mimer-native
```

## Architecture

The library has two layers:

```
Application (JavaScript)
        |
        | require('@mimersql/node-mimer')
        v
JavaScript Wrapper (Promise-based)
  index.js, lib/client.js, lib/prepared.js,
  lib/resultset.js, lib/pool.js
        |
        | lib/native.js (backend selection)
        v
Koffi FFI Backend (lib/koffi-binding.js)
  — or —
@mimersql/node-mimer-native (C++ addon, optional)
        |
        | FFI / Node-API calls
        v
Mimer SQL C API (libmimerapi.so)
        |
        v
Mimer SQL Database
```

The Koffi FFI backend (`lib/koffi-binding.js`) calls the Mimer SQL C API
functions directly using [Koffi](https://koffi.dev/), an FFI library that ships
its own prebuilt binaries. This means `node-mimer` is a pure JavaScript package
with no native compilation step.

The optional `@mimersql/node-mimer-native` package provides the same interface using a
C++ Node-API addon. It can be installed alongside `node-mimer` as a drop-in
replacement if needed.

### Mimer SQL C API Functions Used

- `MimerBeginSession8()` - Establish database connection
- `MimerEndSession()` - Close connection
- `MimerBeginStatement8()` - Prepare SQL statements
- `MimerExecuteStatement8()` - Execute DDL statements directly
- `MimerOpenCursor()` / `MimerFetch()` - Fetch result rows
- `MimerGetString8()`, `MimerGetInt32()`, etc. - Get column values
- `MimerSetString8()`, `MimerSetInt32()`, etc. - Bind parameter values
- `MimerSetLob()` / `MimerSetBlobData()` / `MimerSetNclobData8()` - Write LOBs
- `MimerGetLob()` / `MimerGetBlobData()` / `MimerGetNclobData8()` - Read LOBs
- `MimerBeginTransaction()` / `MimerEndTransaction()` - Transaction control
- `MimerGetError8()` - Error handling

## File Structure

```
node-mimer/
├── lib/                          # JavaScript modules
│   ├── native.js                # Backend selection (Koffi or native)
│   ├── koffi-binding.js         # Koffi FFI backend
│   ├── find-mimer-library.js    # Platform-specific library detection
│   ├── client.js                # MimerClient, connect()
│   ├── prepared.js              # PreparedStatement
│   ├── resultset.js             # ResultSet (cursor wrapper)
│   └── pool.js                  # Pool, PoolClient
│
├── scripts/
│   └── check-mimer.js           # Verify Mimer installation
│
├── index.js                      # Re-exports from lib/
├── index.d.ts                    # TypeScript type definitions
├── package.json
├── README.md
│
└── test/
    ├── helper.js                # Shared test utilities
    └── *.test.js                # Test suites (node:test)
```

## License

MIT

## Contributing

Contributions are welcome! Please submit pull requests or open issues on GitHub.

## References

- [Mimer SQL Documentation](https://developer.mimer.com/documentation)
- [Mimer SQL C API Reference](https://developer.mimer.com/mimerapi)
- [Koffi FFI Library](https://koffi.dev/)
