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

#ifndef MIMER_CONNECTION_H
#define MIMER_CONNECTION_H

#include <napi.h>
#include <mimerapi.h>
#include <string>
#include <set>

class MimerStmtWrapper; // forward declaration
class MimerResultSetWrapper; // forward declaration

/**
 * MimerConnection wraps a Mimer database connection
 * Corresponds to MimerAPI session handle
 */
class MimerConnection : public Napi::ObjectWrap<MimerConnection> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  MimerConnection(const Napi::CallbackInfo& info);
  ~MimerConnection();

  // Statement tracking — called by MimerStmtWrapper
  void RegisterStatement(MimerStmtWrapper* stmt);
  void UnregisterStatement(MimerStmtWrapper* stmt);

  // Result set tracking — called by MimerResultSetWrapper
  void RegisterResultSet(MimerResultSetWrapper* rs);
  void UnregisterResultSet(MimerResultSetWrapper* rs);

private:
  // Connection handle
  MimerSession session_;
  bool connected_;

  // Open statements and result sets created by this connection
  std::set<MimerStmtWrapper*> openStatements_;
  std::set<MimerResultSetWrapper*> openResultSets_;

  // Methods exposed to JavaScript
  Napi::Value Connect(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);
  Napi::Value Execute(const Napi::CallbackInfo& info);
  Napi::Value BeginTransaction(const Napi::CallbackInfo& info);
  Napi::Value Commit(const Napi::CallbackInfo& info);
  Napi::Value Rollback(const Napi::CallbackInfo& info);
  Napi::Value IsConnected(const Napi::CallbackInfo& info);
  Napi::Value Prepare(const Napi::CallbackInfo& info);
  Napi::Value ExecuteQuery(const Napi::CallbackInfo& info);

  // Helper methods
  void CheckError(int rc, const std::string& operation);
  std::string GetErrorMessage();
};

#endif // MIMER_CONNECTION_H
