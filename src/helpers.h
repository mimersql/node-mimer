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

#ifndef MIMER_HELPERS_H
#define MIMER_HELPERS_H

#include <napi.h>
#include <mimerapi.h>
#include <string>
#include <vector>

/**
 * Create and throw a structured Mimer error as a JS exception.
 * The error object gets:
 *   - message: human-readable description
 *   - mimerCode: the numeric Mimer return code (e.g. -24101)
 *   - operation: the Mimer C API function that failed
 */
void ThrowMimerError(Napi::Env env, int rc, const std::string& operation,
                     const std::string& detail = "");

/**
 * Build an array of column metadata objects from a prepared statement.
 * Each element is { name, dataTypeCode, dataTypeName, nullable }.
 * Can be called before or after opening a cursor — only uses column
 * metadata, not row data.
 */
Napi::Array BuildFieldsArray(Napi::Env env, MimerStatement stmt, int columnCount);

/**
 * Bind a JavaScript array of parameters to a prepared Mimer statement.
 * Parameter indices are 1-based in the Mimer API, 0-based in the JS array.
 * Throws a JS exception on error.
 */
void BindParameters(Napi::Env env, MimerStatement stmt, Napi::Array params);

/**
 * Cache column names and type codes from a prepared statement.
 * Populates colNames and colTypes vectors (0-indexed, columns are 1-based in Mimer).
 */
void CacheColumnMetadata(MimerStatement stmt, int columnCount,
                         std::vector<std::string>& colNames,
                         std::vector<int>& colTypes);

/**
 * Fetch a single row from an open cursor into a JS object.
 * Assumes MimerFetch() has already returned MIMER_SUCCESS for this row.
 * Column metadata must have been cached via CacheColumnMetadata().
 */
Napi::Object FetchSingleRow(Napi::Env env, MimerStatement stmt, int columnCount,
                             const std::vector<std::string>& colNames,
                             const std::vector<int>& colTypes);

/**
 * Fetch all result rows from an open cursor into a JS array of objects.
 * Each row is a plain JS object with column names as keys.
 */
Napi::Array FetchResults(Napi::Env env, MimerStatement stmt, int columnCount);

#endif // MIMER_HELPERS_H
