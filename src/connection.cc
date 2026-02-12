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

#include "connection.h"
#include "statement.h"
#include "resultset.h"
#include "helpers.h"
#include <sstream>
#include <cstring>
#include <cstdlib>

/**
 * Initialize the Connection class and export it to JavaScript
 */
Napi::Object MimerConnection::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "Connection", {
    InstanceMethod("connect", &MimerConnection::Connect),
    InstanceMethod("close", &MimerConnection::Close),
    InstanceMethod("execute", &MimerConnection::Execute),
    InstanceMethod("beginTransaction", &MimerConnection::BeginTransaction),
    InstanceMethod("commit", &MimerConnection::Commit),
    InstanceMethod("rollback", &MimerConnection::Rollback),
    InstanceMethod("isConnected", &MimerConnection::IsConnected),
    InstanceMethod("prepare", &MimerConnection::Prepare),
    InstanceMethod("executeQuery", &MimerConnection::ExecuteQuery)
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("Connection", func);
  return exports;
}

/**
 * Constructor
 */
MimerConnection::MimerConnection(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<MimerConnection>(info), session_(nullptr), connected_(false) {
}

/**
 * Destructor - invalidate open statements and close connection
 */
MimerConnection::~MimerConnection() {
  // Invalidate all open result sets before destroying the session
  for (auto* rs : openResultSets_) {
    rs->Invalidate();
  }
  openResultSets_.clear();

  // Invalidate all open statements before destroying the session
  for (auto* stmt : openStatements_) {
    stmt->Invalidate();
  }
  openStatements_.clear();

  if (connected_ && session_ != nullptr) {
    MimerEndSession(&session_);
  }
}

void MimerConnection::RegisterStatement(MimerStmtWrapper* stmt) {
  openStatements_.insert(stmt);
}

void MimerConnection::UnregisterStatement(MimerStmtWrapper* stmt) {
  openStatements_.erase(stmt);
}

void MimerConnection::RegisterResultSet(MimerResultSetWrapper* rs) {
  openResultSets_.insert(rs);
}

void MimerConnection::UnregisterResultSet(MimerResultSetWrapper* rs) {
  openResultSets_.erase(rs);
}

/**
 * Connect to database
 * Arguments: dsn (string), user (string), password (string)
 */
Napi::Value MimerConnection::Connect(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "Expected 3 arguments: dsn, user, password")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (!info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
    Napi::TypeError::New(env, "All arguments must be strings")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string dsn = info[0].As<Napi::String>().Utf8Value();
  std::string user = info[1].As<Napi::String>().Utf8Value();
  std::string password = info[2].As<Napi::String>().Utf8Value();

  // Use the UTF-8 variant of MimerBeginSession
  int rc = MimerBeginSession8(dsn.c_str(), user.c_str(), password.c_str(), &session_);

  if (rc < 0) {
    CheckError(rc, "MimerBeginSession8");
    return env.Undefined();
  }

  connected_ = true;
  return Napi::Boolean::New(env, true);
}

/**
 * Close the database connection.
 * Invalidates all open prepared statements first.
 */
Napi::Value MimerConnection::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    return Napi::Boolean::New(env, true);
  }

  // Invalidate all open result sets before closing the session.
  for (auto* rs : openResultSets_) {
    rs->Invalidate();
  }
  openResultSets_.clear();

  // Invalidate all open statements before closing the session.
  // Invalidate() closes their Mimer handles without trying to
  // unregister from this connection (we clear the set ourselves).
  for (auto* stmt : openStatements_) {
    stmt->Invalidate();
  }
  openStatements_.clear();

  if (session_ != nullptr) {
    int rc = MimerEndSession(&session_);
    if (rc < 0) {
      CheckError(rc, "MimerEndSession");
    }
    connected_ = false;
  }

  return Napi::Boolean::New(env, true);
}

/**
 * Execute SQL statement
 * Arguments: sql (string), params (optional array)
 * Returns: result object with rows and metadata
 */
Napi::Value MimerConnection::Execute(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    Napi::Error::New(env, "Not connected to database")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected SQL string as first argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string sql = info[0].As<Napi::String>().Utf8Value();

  // Check for optional params array
  bool hasParams = (info.Length() >= 2 && info[1].IsArray()
                    && info[1].As<Napi::Array>().Length() > 0);

  // Try to prepare the statement using the UTF-8 variant
  MimerStatement stmt = MIMERNULLHANDLE;
  int rc = MimerBeginStatement8(session_, sql.c_str(), MIMER_FORWARD_ONLY, &stmt);

  // DDL statements (CREATE, DROP, ALTER, etc.) cannot be prepared.
  // Fall back to direct execution via MimerExecuteStatement8.
  if (rc == MIMER_STATEMENT_CANNOT_BE_PREPARED) {
    Napi::Object result = Napi::Object::New(env);
    rc = MimerExecuteStatement8(session_, sql.c_str());
    if (rc < 0) {
      CheckError(rc, "MimerExecuteStatement8");
      return env.Undefined();
    }
    result.Set("rowCount", Napi::Number::New(env, 0));
    return result;
  }

  if (rc < 0) {
    CheckError(rc, "MimerBeginStatement8");
    return env.Undefined();
  }

  // Bind parameters if provided
  if (hasParams) {
    Napi::Array params = info[1].As<Napi::Array>();
    BindParameters(env, stmt, params);
    if (env.IsExceptionPending()) {
      MimerEndStatement(&stmt);
      return env.Undefined();
    }
  }

  // Use MimerColumnCount to determine if this is a SELECT (has result columns)
  int columnCount = MimerColumnCount(stmt);
  bool hasResultSet = (columnCount > 0);

  Napi::Object result = Napi::Object::New(env);

  if (hasResultSet) {
    // Build column metadata before fetching rows
    result.Set("fields", BuildFieldsArray(env, stmt, columnCount));

    // Open cursor for SELECT statements
    rc = MimerOpenCursor(stmt);
    if (rc < 0) {
      CheckError(rc, "MimerOpenCursor");
      MimerEndStatement(&stmt);
      return env.Undefined();
    }

    Napi::Array rows = FetchResults(env, stmt, columnCount);
    result.Set("rows", rows);
    result.Set("rowCount", Napi::Number::New(env, rows.Length()));
  } else {
    // DML statement (INSERT, UPDATE, DELETE)
    rc = MimerExecute(stmt);
    if (rc < 0) {
      CheckError(rc, "MimerExecute");
      MimerEndStatement(&stmt);
      return env.Undefined();
    }
    result.Set("rowCount", Napi::Number::New(env, rc));
  }

  // Clean up statement
  MimerEndStatement(&stmt);

  return result;
}

/**
 * Begin a transaction
 */
Napi::Value MimerConnection::BeginTransaction(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    Napi::Error::New(env, "Not connected to database")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Begin an explicit transaction (disables auto-commit until commit/rollback)
  int rc = MimerBeginTransaction(session_, MIMER_TRANS_READWRITE);
  if (rc < 0) {
    CheckError(rc, "MimerBeginTransaction");
    return env.Undefined();
  }

  return Napi::Boolean::New(env, true);
}

/**
 * Commit current transaction
 */
Napi::Value MimerConnection::Commit(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    Napi::Error::New(env, "Not connected to database")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  int rc = MimerEndTransaction(session_, MIMER_COMMIT);
  if (rc < 0) {
    CheckError(rc, "MimerEndTransaction (commit)");
  }

  return Napi::Boolean::New(env, true);
}

/**
 * Rollback current transaction
 */
Napi::Value MimerConnection::Rollback(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    Napi::Error::New(env, "Not connected to database")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  int rc = MimerEndTransaction(session_, MIMER_ROLLBACK);
  if (rc < 0) {
    CheckError(rc, "MimerEndTransaction (rollback)");
  }

  return Napi::Boolean::New(env, true);
}

/**
 * Check if connected
 */
Napi::Value MimerConnection::IsConnected(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), connected_);
}

/**
 * Prepare a SQL statement for repeated execution
 * Arguments: sql (string)
 * Returns: MimerStmtWrapper object
 */
Napi::Value MimerConnection::Prepare(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    Napi::Error::New(env, "Not connected to database")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected SQL string as first argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Create a MimerStmtWrapper, passing session and SQL
  Napi::Object stmtObj = MimerStmtWrapper::NewInstance(env, session_, info[0].As<Napi::String>());
  if (env.IsExceptionPending()) {
    return env.Undefined();
  }

  // Register the statement so we can invalidate it if the connection closes
  MimerStmtWrapper* stmt = MimerStmtWrapper::Unwrap(stmtObj);
  stmt->SetParentConnection(this);
  openStatements_.insert(stmt);

  return stmtObj;
}

/**
 * Execute a SELECT query and return an open cursor (MimerResultSetWrapper).
 * Arguments: sql (string), params (optional array)
 * Returns: MimerResultSetWrapper (native object)
 */
Napi::Value MimerConnection::ExecuteQuery(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (!connected_) {
    Napi::Error::New(env, "Not connected to database")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected SQL string as first argument")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  std::string sql = info[0].As<Napi::String>().Utf8Value();
  bool hasParams = (info.Length() >= 2 && info[1].IsArray()
                    && info[1].As<Napi::Array>().Length() > 0);

  MimerStatement stmt = MIMERNULLHANDLE;
  int rc = MimerBeginStatement8(session_, sql.c_str(), MIMER_FORWARD_ONLY, &stmt);

  if (rc == MIMER_STATEMENT_CANNOT_BE_PREPARED) {
    Napi::Error::New(env, "queryCursor only supports SELECT statements (DDL cannot be prepared)")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (rc < 0) {
    CheckError(rc, "MimerBeginStatement8");
    return env.Undefined();
  }

  // Bind parameters if provided
  if (hasParams) {
    Napi::Array params = info[1].As<Napi::Array>();
    BindParameters(env, stmt, params);
    if (env.IsExceptionPending()) {
      MimerEndStatement(&stmt);
      return env.Undefined();
    }
  }

  int columnCount = MimerColumnCount(stmt);
  if (columnCount <= 0) {
    MimerEndStatement(&stmt);
    Napi::Error::New(env, "queryCursor only supports SELECT statements (DML has no result columns)")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Open cursor
  rc = MimerOpenCursor(stmt);
  if (rc < 0) {
    CheckError(rc, "MimerOpenCursor");
    MimerEndStatement(&stmt);
    return env.Undefined();
  }

  // Create ResultSet wrapper — transfers ownership of stmt
  Napi::Object rsObj = MimerResultSetWrapper::NewInstance(env, stmt, columnCount);
  if (env.IsExceptionPending()) {
    MimerCloseCursor(stmt);
    MimerEndStatement(&stmt);
    return env.Undefined();
  }

  // Register for lifecycle tracking
  MimerResultSetWrapper* rs = MimerResultSetWrapper::Unwrap(rsObj);
  rs->SetParentConnection(this);
  openResultSets_.insert(rs);

  return rsObj;
}

/**
 * Check for errors and throw structured JavaScript exception if error occurred
 */
void MimerConnection::CheckError(int rc, const std::string& operation) {
  if (rc < 0) {
    std::string detail = GetErrorMessage();
    ThrowMimerError(Env(), rc, operation, detail);
  }
}

/**
 * Get detailed error message from Mimer
 */
std::string MimerConnection::GetErrorMessage() {
  if (session_ != nullptr) {
    int32_t errCode;
    char buffer[1024];
    // MimerGetError8 signature: (void*, int32_t*, char*, size_t)
    int rc = MimerGetError8(session_, &errCode, buffer, sizeof(buffer));
    if (rc > 0) {
      return std::string(buffer);
    }
  }
  return "Unknown error";
}
