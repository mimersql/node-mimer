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

#include "statement.h"
#include "connection.h"
#include "helpers.h"
#include <sstream>

Napi::FunctionReference MimerStmtWrapper::constructor_;

/**
 * Initialize the Statement class and export it
 */
Napi::Object MimerStmtWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "Statement", {
    InstanceMethod("execute", &MimerStmtWrapper::Execute),
    InstanceMethod("close", &MimerStmtWrapper::Close)
  });

  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();

  exports.Set("Statement", func);
  return exports;
}

/**
 * Create a new MimerStmtWrapper instance from C++.
 * Called by MimerConnection::Prepare().
 * We pass session and sql as External values through the constructor.
 */
Napi::Object MimerStmtWrapper::NewInstance(Napi::Env env, MimerSession session,
                                            Napi::String sql) {
  // Pass session pointer and SQL string to the JS constructor
  Napi::External<MimerSession> extSession =
      Napi::External<MimerSession>::New(env, new MimerSession(session));
  return constructor_.New({extSession, sql});
}

/**
 * Constructor - prepares the SQL statement.
 * When called from NewInstance: info[0] = External<MimerSession>, info[1] = String (SQL)
 */
MimerStmtWrapper::MimerStmtWrapper(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<MimerStmtWrapper>(info),
    stmt_(MIMERNULLHANDLE), columnCount_(0), closed_(false),
    parentConnection_(nullptr) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsExternal() || !info[1].IsString()) {
    Napi::TypeError::New(env, "Statement cannot be constructed directly; use connection.prepare()")
        .ThrowAsJavaScriptException();
    return;
  }

  MimerSession* sessionPtr = info[0].As<Napi::External<MimerSession>>().Data();
  std::string sql = info[1].As<Napi::String>().Utf8Value();

  int rc = MimerBeginStatement8(*sessionPtr, sql.c_str(), MIMER_FORWARD_ONLY, &stmt_);

  // Clean up the allocated session pointer copy
  delete sessionPtr;

  if (rc < 0) {
    ThrowMimerError(env, rc, "MimerBeginStatement8");
    return;
  }

  columnCount_ = MimerColumnCount(stmt_);
}

/**
 * Destructor - clean up statement handle if not already closed
 */
MimerStmtWrapper::~MimerStmtWrapper() {
  if (!closed_ && stmt_ != MIMERNULLHANDLE) {
    MimerEndStatement(&stmt_);
    // Unregister from parent if it still exists
    if (parentConnection_) {
      parentConnection_->UnregisterStatement(this);
      parentConnection_ = nullptr;
    }
  }
}

void MimerStmtWrapper::SetParentConnection(MimerConnection* conn) {
  parentConnection_ = conn;
}

/**
 * Called by MimerConnection::Close() to invalidate this statement.
 * Closes the Mimer handle but does NOT unregister from the connection
 * (the connection is clearing its own set).
 */
void MimerStmtWrapper::Invalidate() {
  if (!closed_ && stmt_ != MIMERNULLHANDLE) {
    MimerEndStatement(&stmt_);
  }
  closed_ = true;
  parentConnection_ = nullptr;
}

/**
 * Internal close: release the Mimer handle and unregister from the
 * parent connection.
 */
void MimerStmtWrapper::CloseInternal() {
  if (!closed_ && stmt_ != MIMERNULLHANDLE) {
    MimerEndStatement(&stmt_);
  }
  closed_ = true;
  if (parentConnection_) {
    parentConnection_->UnregisterStatement(this);
    parentConnection_ = nullptr;
  }
}

/**
 * Execute the prepared statement with optional parameters.
 * Arguments: params (optional array)
 * Returns: result object with rows and metadata
 */
Napi::Value MimerStmtWrapper::Execute(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    Napi::Error::New(env, "Statement is closed")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  // Bind parameters if provided
  if (info.Length() >= 1 && info[0].IsArray()
      && info[0].As<Napi::Array>().Length() > 0) {
    Napi::Array params = info[0].As<Napi::Array>();
    BindParameters(env, stmt_, params);
    if (env.IsExceptionPending()) {
      return env.Undefined();
    }
  }

  bool hasResultSet = (columnCount_ > 0);
  Napi::Object result = Napi::Object::New(env);
  int rc;

  if (hasResultSet) {
    // Build column metadata before fetching rows
    result.Set("fields", BuildFieldsArray(env, stmt_, columnCount_));

    rc = MimerOpenCursor(stmt_);
    if (rc < 0) {
      ThrowMimerError(env, rc, "MimerOpenCursor");
      return env.Undefined();
    }

    Napi::Array rows = FetchResults(env, stmt_, columnCount_);

    // Close cursor but keep statement alive for reuse
    MimerCloseCursor(stmt_);

    result.Set("rows", rows);
    result.Set("rowCount", Napi::Number::New(env, rows.Length()));
  } else {
    rc = MimerExecute(stmt_);
    if (rc < 0) {
      ThrowMimerError(env, rc, "MimerExecute");
      return env.Undefined();
    }
    result.Set("rowCount", Napi::Number::New(env, rc));
  }

  return result;
}

/**
 * Close the prepared statement and release its handle.
 */
Napi::Value MimerStmtWrapper::Close(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  CloseInternal();
  return Napi::Boolean::New(env, true);
}
