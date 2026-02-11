/**
 * node-mimer - Node.js bindings for Mimer SQL
 */

export interface ConnectOptions {
  /** Database name */
  dsn: string;
  /** Username */
  user: string;
  /** Password */
  password: string;
}

export interface PoolOptions extends ConnectOptions {
  /** Maximum number of connections (default 10) */
  max?: number;
  /** Milliseconds before an idle connection is closed (default 30000) */
  idleTimeout?: number;
  /** Milliseconds to wait for a connection when pool is full (default 5000) */
  acquireTimeout?: number;
}

export interface FieldInfo {
  /** Column name */
  name: string;
  /** Numeric Mimer type code */
  dataTypeCode: number;
  /** Human-readable SQL type name (e.g. "INTEGER", "NVARCHAR") */
  dataTypeName: string;
  /** Whether the column allows NULL values */
  nullable: boolean;
}

export interface QueryResult {
  /** Array of row objects (SELECT only) */
  rows?: Record<string, any>[];
  /** Number of rows returned or affected */
  rowCount: number;
  /** Column metadata (SELECT only) */
  fields?: FieldInfo[];
}

export class MimerClient {
  /** Whether the client is currently connected */
  connected: boolean;

  /** Connect to a Mimer SQL database */
  connect(options: ConnectOptions): Promise<void>;

  /** Execute a SQL statement with optional parameter binding */
  query(sql: string, params?: any[]): Promise<QueryResult>;

  /** Prepare a SQL statement for repeated execution */
  prepare(sql: string): Promise<PreparedStatement>;

  /** Execute a SELECT and return a cursor for row-at-a-time streaming */
  queryCursor(sql: string, params?: any[]): Promise<ResultSet>;

  /** Begin a new transaction */
  beginTransaction(): Promise<void>;

  /** Commit the current transaction */
  commit(): Promise<void>;

  /** Rollback the current transaction */
  rollback(): Promise<void>;

  /** Close the database connection */
  close(): Promise<void>;

  /** Check if connected to database */
  isConnected(): boolean;
}

export class PreparedStatement {
  /** Execute the prepared statement with parameter values */
  execute(params?: any[]): Promise<QueryResult>;

  /** Close the prepared statement and release resources */
  close(): Promise<void>;
}

export class ResultSet {
  /** Column metadata array */
  readonly fields: FieldInfo[];

  /** Fetch the next row, or null when exhausted */
  next(): Promise<Record<string, any> | null>;

  /** Close the cursor and release resources */
  close(): Promise<void>;

  /** Async iterator for for-await-of */
  [Symbol.asyncIterator](): AsyncIterableIterator<Record<string, any>>;
}

export class Pool {
  /** Total number of connections (idle + active) */
  readonly totalCount: number;

  /** Number of idle connections */
  readonly idleCount: number;

  /** Number of checked-out connections */
  readonly activeCount: number;

  /** Number of callers waiting for a connection */
  readonly waitingCount: number;

  /** Acquire a connection, execute the query, and release */
  query(sql: string, params?: any[]): Promise<QueryResult>;

  /** Acquire a connection and open a cursor (auto-released on close) */
  queryCursor(sql: string, params?: any[]): Promise<ResultSet>;

  /** Check out a connection for multiple operations */
  connect(): Promise<PoolClient>;

  /** Close all connections and shut down the pool */
  end(): Promise<void>;
}

export class PoolClient {
  /** Execute a SQL statement */
  query(sql: string, params?: any[]): Promise<QueryResult>;

  /** Open a cursor for row-at-a-time streaming */
  queryCursor(sql: string, params?: any[]): Promise<ResultSet>;

  /** Prepare a SQL statement */
  prepare(sql: string): Promise<PreparedStatement>;

  /** Begin a new transaction */
  beginTransaction(): Promise<void>;

  /** Commit the current transaction */
  commit(): Promise<void>;

  /** Rollback the current transaction */
  rollback(): Promise<void>;

  /** Return the connection to the pool */
  release(): void;
}

/** Create and connect a new MimerClient */
export function connect(options: ConnectOptions): Promise<MimerClient>;

/** Create a new connection pool */
export function createPool(options: PoolOptions): Pool;

/** Native addon version string */
export const version: string;
