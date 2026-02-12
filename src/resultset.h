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

#ifndef MIMER_RESULTSET_H
#define MIMER_RESULTSET_H

#include <napi.h>
#include <mimerapi.h>
#include <vector>
#include <string>

class MimerConnection; // forward declaration

/**
 * MimerResultSetWrapper wraps an open Mimer cursor for row-at-a-time
 * fetching.  Owns the MimerStatement handle (cursor already opened by
 * MimerConnection::ExecuteQuery).
 *
 * Lifecycle follows the same pattern as MimerStmtWrapper:
 *   - Invalidate()   — called by connection close (closes handles, no unregister)
 *   - CloseInternal() — closes handles AND unregisters from parent
 *   - Destructor calls CloseInternal()
 */
class MimerResultSetWrapper : public Napi::ObjectWrap<MimerResultSetWrapper> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object NewInstance(Napi::Env env, MimerStatement stmt,
                                  int columnCount);
  MimerResultSetWrapper(const Napi::CallbackInfo& info);
  ~MimerResultSetWrapper();

  void SetParentConnection(MimerConnection* conn);
  void Invalidate();

private:
  MimerStatement stmt_;
  int columnCount_;
  std::vector<std::string> colNames_;
  std::vector<int> colTypes_;
  bool closed_;
  bool exhausted_;
  MimerConnection* parentConnection_;

  // JS-exposed methods
  Napi::Value FetchNext(const Napi::CallbackInfo& info);
  Napi::Value GetFields(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);
  Napi::Value IsClosed(const Napi::CallbackInfo& info);

  void CloseInternal();

  static Napi::FunctionReference constructor_;
};

#endif // MIMER_RESULTSET_H
