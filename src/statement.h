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

#ifndef MIMER_STATEMENT_H
#define MIMER_STATEMENT_H

#include <napi.h>
#include <mimerapi.h>

class MimerConnection; // forward declaration

/**
 * MimerStmtWrapper wraps a Mimer prepared statement for reuse.
 * Note: Cannot use 'MimerStatement' as class name since it's
 * typedef'd in mimerapi.h.
 *
 * The statement handle persists across multiple execute() calls.
 * After each execution with a cursor, we close the cursor but keep
 * the prepared statement alive for reuse.
 *
 * Tracks its parent connection so it can be invalidated if the
 * connection is closed while this statement is still open.
 */
class MimerStmtWrapper : public Napi::ObjectWrap<MimerStmtWrapper> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  static Napi::Object NewInstance(Napi::Env env, MimerSession session,
                                  Napi::String sql);
  MimerStmtWrapper(const Napi::CallbackInfo& info);
  ~MimerStmtWrapper();

  // Called by MimerConnection to set the parent after construction
  void SetParentConnection(MimerConnection* conn);

  // Called by MimerConnection::Close() to invalidate this statement
  // without the statement trying to unregister from the connection
  void Invalidate();

private:
  MimerStatement stmt_;
  int columnCount_;
  bool closed_;
  MimerConnection* parentConnection_;

  // Methods exposed to JavaScript
  Napi::Value Execute(const Napi::CallbackInfo& info);
  Napi::Value Close(const Napi::CallbackInfo& info);

  // Internal close logic shared by Close() and destructor
  void CloseInternal();

  static Napi::FunctionReference constructor_;
};

#endif // MIMER_STATEMENT_H
