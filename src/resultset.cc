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

#include "resultset.h"
#include "connection.h"
#include "helpers.h"

Napi::FunctionReference MimerResultSetWrapper::constructor_;

Napi::Object MimerResultSetWrapper::Init(Napi::Env env, Napi::Object exports) {
  Napi::Function func = DefineClass(env, "ResultSet", {
    InstanceMethod("fetchNext", &MimerResultSetWrapper::FetchNext),
    InstanceMethod("getFields", &MimerResultSetWrapper::GetFields),
    InstanceMethod("close", &MimerResultSetWrapper::Close),
    InstanceMethod("isClosed", &MimerResultSetWrapper::IsClosed)
  });

  constructor_ = Napi::Persistent(func);
  constructor_.SuppressDestruct();

  exports.Set("ResultSet", func);
  return exports;
}

/**
 * Create a new ResultSet from C++.
 * Passes the MimerStatement handle and columnCount as External values.
 */
Napi::Object MimerResultSetWrapper::NewInstance(Napi::Env env,
                                                 MimerStatement stmt,
                                                 int columnCount) {
  Napi::External<MimerStatement> extStmt =
      Napi::External<MimerStatement>::New(env, new MimerStatement(stmt));
  Napi::Number colCount = Napi::Number::New(env, columnCount);
  return constructor_.New({extStmt, colCount});
}

/**
 * Constructor — receives External<MimerStatement> and columnCount.
 */
MimerResultSetWrapper::MimerResultSetWrapper(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<MimerResultSetWrapper>(info),
    stmt_(MIMERNULLHANDLE), columnCount_(0),
    closed_(false), exhausted_(false), parentConnection_(nullptr) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 || !info[0].IsExternal() || !info[1].IsNumber()) {
    Napi::TypeError::New(env,
        "ResultSet cannot be constructed directly; use connection.executeQuery()")
        .ThrowAsJavaScriptException();
    return;
  }

  MimerStatement* stmtPtr = info[0].As<Napi::External<MimerStatement>>().Data();
  stmt_ = *stmtPtr;
  delete stmtPtr;

  columnCount_ = info[1].As<Napi::Number>().Int32Value();

  // Cache column metadata once
  CacheColumnMetadata(stmt_, columnCount_, colNames_, colTypes_);
}

MimerResultSetWrapper::~MimerResultSetWrapper() {
  CloseInternal();
}

void MimerResultSetWrapper::SetParentConnection(MimerConnection* conn) {
  parentConnection_ = conn;
}

/**
 * Called by MimerConnection::Close() — close handles without unregistering.
 */
void MimerResultSetWrapper::Invalidate() {
  if (!closed_ && stmt_ != MIMERNULLHANDLE) {
    MimerCloseCursor(stmt_);
    MimerEndStatement(&stmt_);
  }
  closed_ = true;
  parentConnection_ = nullptr;
}

/**
 * Close handles AND unregister from parent connection.
 */
void MimerResultSetWrapper::CloseInternal() {
  if (!closed_ && stmt_ != MIMERNULLHANDLE) {
    MimerCloseCursor(stmt_);
    MimerEndStatement(&stmt_);
  }
  closed_ = true;
  if (parentConnection_) {
    parentConnection_->UnregisterResultSet(this);
    parentConnection_ = nullptr;
  }
}

/**
 * Fetch the next row. Returns a JS object, or null when exhausted / closed.
 */
Napi::Value MimerResultSetWrapper::FetchNext(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_ || exhausted_) {
    return env.Null();
  }

  int rc = MimerFetch(stmt_);
  if (rc == MIMER_SUCCESS) {
    return FetchSingleRow(env, stmt_, columnCount_, colNames_, colTypes_);
  }

  // No more rows (or error) — mark exhausted
  exhausted_ = true;
  return env.Null();
}

/**
 * Return column metadata array (same format as fields in query results).
 */
Napi::Value MimerResultSetWrapper::GetFields(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (closed_) {
    return Napi::Array::New(env, 0);
  }

  return BuildFieldsArray(env, stmt_, columnCount_);
}

/**
 * Explicitly close the cursor and release the statement handle.
 */
Napi::Value MimerResultSetWrapper::Close(const Napi::CallbackInfo& info) {
  CloseInternal();
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value MimerResultSetWrapper::IsClosed(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(), closed_);
}
