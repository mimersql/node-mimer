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

#include "helpers.h"
#include <cstring>
#include <sstream>
#include <cmath>
#include <climits>
#include <vector>
#include <string>

static constexpr size_t LOB_READ_CHUNK  = 65536;
static constexpr size_t LOB_WRITE_CHUNK = 2 * 1024 * 1024;  // 2 MB, well under ~10 MB API limit

/**
 * Count the number of UTF-8 characters (code points) in a byte string.
 */
static size_t Utf8CharCount(const char* s, size_t byteLen) {
  size_t count = 0;
  for (size_t i = 0; i < byteLen; ) {
    unsigned char c = static_cast<unsigned char>(s[i]);
    if (c < 0x80)        i += 1;
    else if ((c & 0xE0) == 0xC0) i += 2;
    else if ((c & 0xF0) == 0xE0) i += 3;
    else                  i += 4;
    count++;
  }
  return count;
}

/**
 * Create and throw a structured Mimer error.
 * Sets error.mimerCode and error.operation on the JS Error object.
 */
void ThrowMimerError(Napi::Env env, int rc, const std::string& operation,
                     const std::string& detail) {
  std::ostringstream oss;
  if (detail.empty()) {
    oss << operation << " failed (code: " << rc << ")";
  } else {
    oss << operation << " failed: " << detail << " (code: " << rc << ")";
  }

  Napi::Error error = Napi::Error::New(env, oss.str());
  error.Set("mimerCode", Napi::Number::New(env, rc));
  error.Set("operation", Napi::String::New(env, operation));
  error.ThrowAsJavaScriptException();
}

/**
 * Map a Mimer type code (absolute value) to a human-readable SQL type name.
 */
static const char* MimerTypeName(int absType) {
  switch (absType) {
    case MIMER_CHARACTER:          return "CHARACTER";
    case MIMER_CHARACTER_VARYING:  return "CHARACTER VARYING";
    case MIMER_NCHAR:              return "NCHAR";
    case MIMER_NCHAR_VARYING:      return "NCHAR VARYING";
    case MIMER_UTF8:               return "NVARCHAR";
    case MIMER_DECIMAL:            return "DECIMAL";
    case MIMER_NUMERIC:            return "NUMERIC";
    case MIMER_INTEGER:            return "INTEGER";
    case MIMER_UNSIGNED_INTEGER:   return "INTEGER";
    case MIMER_T_INTEGER:          return "INTEGER";
    case MIMER_T_UNSIGNED_INTEGER: return "INTEGER";
    case MIMER_T_SMALLINT:         return "SMALLINT";
    case MIMER_T_UNSIGNED_SMALLINT:return "SMALLINT";
    case MIMER_T_BIGINT:           return "BIGINT";
    case MIMER_T_UNSIGNED_BIGINT:  return "BIGINT";
    case MIMER_FLOAT:              return "FLOAT";
    case MIMER_T_FLOAT:            return "FLOAT";
    case MIMER_T_REAL:             return "REAL";
    case MIMER_T_DOUBLE:           return "DOUBLE PRECISION";
    case MIMER_BOOLEAN:            return "BOOLEAN";
    case MIMER_DATE:               return "DATE";
    case MIMER_TIME:               return "TIME";
    case MIMER_TIMESTAMP:          return "TIMESTAMP";
    case MIMER_BINARY:             return "BINARY";
    case MIMER_BINARY_VARYING:     return "BINARY VARYING";
    case MIMER_BLOB:               return "BLOB";
    case MIMER_CLOB:               return "CLOB";
    case MIMER_NCLOB:              return "NCLOB";
    case MIMER_BLOB_LOCATOR:       return "BLOB";
    case MIMER_CLOB_LOCATOR:       return "CLOB";
    case MIMER_NCLOB_LOCATOR:      return "NCLOB";
    case MIMER_NATIVE_SMALLINT:
    case MIMER_NATIVE_SMALLINT_NULLABLE: return "SMALLINT";
    case MIMER_NATIVE_INTEGER:
    case MIMER_NATIVE_INTEGER_NULLABLE:  return "INTEGER";
    case MIMER_NATIVE_BIGINT:
    case MIMER_NATIVE_BIGINT_NULLABLE:   return "BIGINT";
    case MIMER_NATIVE_REAL:
    case MIMER_NATIVE_REAL_NULLABLE:     return "REAL";
    case MIMER_NATIVE_DOUBLE:
    case MIMER_NATIVE_DOUBLE_NULLABLE:   return "DOUBLE PRECISION";
    case MIMER_NATIVE_BLOB:
    case MIMER_NATIVE_BLOB_LOCATOR:      return "BLOB";
    case MIMER_NATIVE_CLOB:
    case MIMER_NATIVE_CLOB_LOCATOR:      return "CLOB";
    case MIMER_NATIVE_NCLOB:
    case MIMER_NATIVE_NCLOB_LOCATOR:     return "NCLOB";
    case MIMER_UUID:                     return "UUID";
    default: {
      // Interval types
      if (absType >= MIMER_INTERVAL_YEAR && absType <= MIMER_INTERVAL_MINUTE_TO_SECOND) {
        return "INTERVAL";
      }
      return "UNKNOWN";
    }
  }
}

/**
 * Build an array of column metadata objects from a prepared statement.
 * Each element is { name, dataTypeCode, dataTypeName, nullable }.
 * In the Mimer C API, a negative type code indicates the column is nullable.
 */
Napi::Array BuildFieldsArray(Napi::Env env, MimerStatement stmt, int columnCount) {
  Napi::Array fields = Napi::Array::New(env, columnCount);

  for (int col = 1; col <= columnCount; col++) {
    Napi::Object field = Napi::Object::New(env);

    // Column name
    char nameBuf[256];
    MimerColumnName8(stmt, static_cast<int16_t>(col), nameBuf, sizeof(nameBuf));
    field.Set("name", Napi::String::New(env, nameBuf));

    // Column type — raw code from Mimer
    // Negative type code means nullable for non-native types.
    // Native types use even codes for nullable variants:
    //   MIMER_NATIVE_xxx (odd) = NOT NULL, MIMER_NATIVE_xxx_NULLABLE (even) = nullable
    int rawType = MimerColumnType(stmt, static_cast<int16_t>(col));
    field.Set("dataTypeCode", Napi::Number::New(env, rawType));

    // Human-readable type name (uses absolute value)
    int absType = rawType < 0 ? -rawType : rawType;
    field.Set("dataTypeName", Napi::String::New(env, MimerTypeName(absType)));

    // Determine nullability
    bool nullable;
    if (rawType < 0) {
      // Non-native types: negative code means nullable
      nullable = true;
    } else if (absType == MIMER_NATIVE_SMALLINT_NULLABLE
            || absType == MIMER_NATIVE_INTEGER_NULLABLE
            || absType == MIMER_NATIVE_BIGINT_NULLABLE
            || absType == MIMER_NATIVE_REAL_NULLABLE
            || absType == MIMER_NATIVE_DOUBLE_NULLABLE) {
      // Native types with explicit _NULLABLE variants
      nullable = true;
    } else {
      nullable = false;
    }
    field.Set("nullable", Napi::Boolean::New(env, nullable));

    fields.Set(static_cast<uint32_t>(col - 1), field);
  }

  return fields;
}

/**
 * Bind a JavaScript array of parameters to a prepared Mimer statement.
 * JS array is 0-indexed, Mimer parameters are 1-indexed.
 */
void BindParameters(Napi::Env env, MimerStatement stmt, Napi::Array params) {
  int paramCount = MimerParameterCount(stmt);
  int providedCount = static_cast<int>(params.Length());

  if (providedCount != paramCount) {
    std::ostringstream detail;
    detail << "statement expects " << paramCount
           << " but " << providedCount << " were provided";
    ThrowMimerError(env, 0, "BindParameters", detail.str());
    return;
  }

  for (int i = 0; i < providedCount; i++) {
    int16_t paramIndex = static_cast<int16_t>(i + 1); // Mimer is 1-based
    Napi::Value val = params[static_cast<uint32_t>(i)];
    int rc;

    if (val.IsNull() || val.IsUndefined()) {
      rc = MimerSetNull(stmt, paramIndex);
    } else if (val.IsBoolean()) {
      rc = MimerSetBoolean(stmt, paramIndex, val.As<Napi::Boolean>().Value() ? 1 : 0);
    } else if (val.IsNumber()) {
      double num = val.As<Napi::Number>().DoubleValue();
      // Check if it's an integer value
      if (std::trunc(num) == num && std::isfinite(num)) {
        if (num >= INT32_MIN && num <= INT32_MAX) {
          rc = MimerSetInt32(stmt, paramIndex, static_cast<int32_t>(num));
        } else {
          rc = MimerSetInt64(stmt, paramIndex, static_cast<int64_t>(num));
        }
      } else {
        rc = MimerSetDouble(stmt, paramIndex, num);
      }
    } else if (val.IsString()) {
      std::string str = val.As<Napi::String>().Utf8Value();
      int ptype = MimerParameterType(stmt, paramIndex);
      if (MimerIsNclob(ptype)) {
        MimerLob lobHandle;
        size_t charCount = Utf8CharCount(str.c_str(), str.size());
        rc = MimerSetLob(stmt, paramIndex, charCount, &lobHandle);
        if (rc == 0) {
          const char* data = str.c_str();
          size_t remaining = str.size();
          size_t offset = 0;
          while (remaining > 0 && rc >= 0) {
            size_t chunk = remaining < LOB_WRITE_CHUNK ? remaining : LOB_WRITE_CHUNK;
            // Don't split multi-byte UTF-8 sequences at chunk boundary
            while (chunk > 0 && chunk < remaining
                   && (data[offset + chunk] & 0xC0) == 0x80) {
              chunk--;
            }
            rc = MimerSetNclobData8(&lobHandle, data + offset, chunk);
            offset += chunk;
            remaining -= chunk;
          }
        }
      } else {
        rc = MimerSetString8(stmt, paramIndex, str.c_str());
      }
    } else if (val.IsBuffer()) {
      Napi::Buffer<uint8_t> buf = val.As<Napi::Buffer<uint8_t>>();
      int ptype = MimerParameterType(stmt, paramIndex);
      if (MimerIsBlob(ptype)) {
        MimerLob lobHandle;
        rc = MimerSetLob(stmt, paramIndex, buf.Length(), &lobHandle);
        if (rc == 0) {
          const uint8_t* data = buf.Data();
          size_t remaining = buf.Length();
          size_t offset = 0;
          while (remaining > 0 && rc >= 0) {
            size_t chunk = remaining < LOB_WRITE_CHUNK ? remaining : LOB_WRITE_CHUNK;
            rc = MimerSetBlobData(&lobHandle, data + offset, chunk);
            offset += chunk;
            remaining -= chunk;
          }
        }
      } else {
        rc = MimerSetBinary(stmt, paramIndex, buf.Data(), buf.Length());
      }
    } else {
      // Try to convert to string as fallback
      std::string str = val.ToString().Utf8Value();
      rc = MimerSetString8(stmt, paramIndex, str.c_str());
    }

    if (rc < 0) {
      std::ostringstream detail;
      detail << "failed to bind parameter " << (i + 1);
      ThrowMimerError(env, rc, "BindParameters", detail.str());
      return;
    }
  }
}

/**
 * Cache column names and type codes from a prepared statement.
 */
void CacheColumnMetadata(MimerStatement stmt, int columnCount,
                         std::vector<std::string>& colNames,
                         std::vector<int>& colTypes) {
  colNames.resize(columnCount);
  colTypes.resize(columnCount);
  for (int col = 1; col <= columnCount; col++) {
    char colNameBuf[256];
    MimerColumnName8(stmt, static_cast<int16_t>(col), colNameBuf, sizeof(colNameBuf));
    colNames[col - 1] = colNameBuf;
    colTypes[col - 1] = MimerColumnType(stmt, static_cast<int16_t>(col));
  }
}

/**
 * Fetch a single row from an open cursor into a JS object.
 * Assumes MimerFetch() has already returned MIMER_SUCCESS.
 */
Napi::Object FetchSingleRow(Napi::Env env, MimerStatement stmt, int columnCount,
                             const std::vector<std::string>& colNames,
                             const std::vector<int>& colTypes) {
  Napi::Object row = Napi::Object::New(env);
  int rc;

  for (int col = 1; col <= columnCount; col++) {
    const char* colName = colNames[col - 1].c_str();
    int colType = colTypes[col - 1];

    // Check if NULL
    if (MimerIsNull(stmt, static_cast<int16_t>(col)) > 0) {
      row.Set(colName, env.Null());
      continue;
    }

    // Get value based on type
    if (MimerIsInt32(colType)) {
      int32_t value;
      rc = MimerGetInt32(stmt, static_cast<int16_t>(col), &value);
      if (rc == 0) {
        row.Set(colName, Napi::Number::New(env, value));
      }
    } else if (MimerIsInt64(colType)) {
      int64_t value;
      rc = MimerGetInt64(stmt, static_cast<int16_t>(col), &value);
      if (rc == 0) {
        row.Set(colName, Napi::Number::New(env, static_cast<double>(value)));
      }
    } else if (MimerIsDouble(colType)) {
      double value;
      rc = MimerGetDouble(stmt, static_cast<int16_t>(col), &value);
      if (rc == 0) {
        row.Set(colName, Napi::Number::New(env, value));
      }
    } else if (MimerIsFloat(colType)) {
      float value;
      rc = MimerGetFloat(stmt, static_cast<int16_t>(col), &value);
      if (rc == 0) {
        row.Set(colName, Napi::Number::New(env, value));
      }
    } else if (MimerIsBoolean(colType)) {
      int32_t value = MimerGetBoolean(stmt, static_cast<int16_t>(col));
      row.Set(colName, Napi::Boolean::New(env, value > 0));
    } else if (MimerIsBlob(colType)) {
      // BLOB → Buffer via LOB API, read in chunks
      size_t lobSize;
      MimerLob lobHandle;
      rc = MimerGetLob(stmt, static_cast<int16_t>(col), &lobSize, &lobHandle);
      if (rc == 0 && lobSize > 0) {
        uint8_t* buf = new uint8_t[lobSize];
        size_t offset = 0;
        size_t remaining = lobSize;
        while (remaining > 0) {
          size_t chunk = remaining < LOB_READ_CHUNK ? remaining : LOB_READ_CHUNK;
          rc = MimerGetBlobData(&lobHandle, buf + offset, chunk);
          if (rc < 0) break;
          offset += chunk;
          remaining -= chunk;
        }
        if (rc >= 0) {
          row.Set(colName, Napi::Buffer<uint8_t>::Copy(env, buf, lobSize));
        }
        delete[] buf;
      } else if (rc == 0) {
        row.Set(colName, Napi::Buffer<uint8_t>::New(env, 0));
      }
    } else if (MimerIsNclob(colType)) {
      // CLOB/NCLOB → String via LOB API, read in chunks
      size_t charCount;
      MimerLob lobHandle;
      rc = MimerGetLob(stmt, static_cast<int16_t>(col), &charCount, &lobHandle);
      if (rc == 0 && charCount > 0) {
        std::string result;
        result.reserve(charCount); // at least charCount bytes
        char chunkBuf[LOB_READ_CHUNK + 1];
        do {
          rc = MimerGetNclobData8(&lobHandle, chunkBuf, sizeof(chunkBuf));
          if (rc < 0) break;
          result.append(chunkBuf);
        } while (rc > 0);
        if (rc >= 0) {
          row.Set(colName, Napi::String::New(env, result));
        }
      } else if (rc == 0) {
        row.Set(colName, Napi::String::New(env, ""));
      }
    } else if (MimerIsBinary(colType)) {
      int32_t size = MimerGetBinary(stmt, static_cast<int16_t>(col), nullptr, 0);
      if (size > 0) {
        uint8_t* buffer = new uint8_t[size];
        rc = MimerGetBinary(stmt, static_cast<int16_t>(col), buffer, size);
        if (rc >= 0) {
          row.Set(colName, Napi::Buffer<uint8_t>::Copy(env, buffer, size));
        }
        delete[] buffer;
      } else {
        row.Set(colName, Napi::Buffer<uint8_t>::New(env, 0));
      }
    } else {
      // Default: try as string (covers VARCHAR, DATE, TIME, TIMESTAMP, DECIMAL, UUID, etc.)
      // Use a single buffer that fits most values on the first call.
      // Only retry with the exact size if the value was truncated.
      char buf[256];
      int32_t size = MimerGetString8(stmt, static_cast<int16_t>(col), buf, sizeof(buf));
      if (size > 0 && size < static_cast<int32_t>(sizeof(buf))) {
        row.Set(colName, Napi::String::New(env, buf));
      } else if (size >= static_cast<int32_t>(sizeof(buf))) {
        char* buffer = new char[size + 1];
        rc = MimerGetString8(stmt, static_cast<int16_t>(col), buffer, size + 1);
        if (rc >= 0) {
          row.Set(colName, Napi::String::New(env, buffer));
        }
        delete[] buffer;
      } else {
        row.Set(colName, Napi::String::New(env, ""));
      }
    }
  }

  return row;
}

/**
 * Fetch all result rows from an open cursor into a JS array of objects.
 */
Napi::Array FetchResults(Napi::Env env, MimerStatement stmt, int columnCount) {
  std::vector<std::string> colNames;
  std::vector<int> colTypes;
  CacheColumnMetadata(stmt, columnCount, colNames, colTypes);

  Napi::Array rows = Napi::Array::New(env);
  int rowIndex = 0;

  while (MimerFetch(stmt) == MIMER_SUCCESS) {
    Napi::Object row = FetchSingleRow(env, stmt, columnCount, colNames, colTypes);
    rows.Set(rowIndex++, row);
  }

  return rows;
}
