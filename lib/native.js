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

'use strict';

/**
 * Backend selection for node-mimer.
 *
 * Default: Koffi FFI (pure JS, no compilation needed).
 * If the optional `@mimersql/node-mimer-native` package is installed, it is used instead.
 *
 * Override with NODE_MIMER_BACKEND environment variable:
 *   NODE_MIMER_BACKEND=koffi   — force Koffi FFI backend
 *   NODE_MIMER_BACKEND=native  — force @mimersql/node-mimer-native (C++ addon)
 */

let binding;
const backend = process.env.NODE_MIMER_BACKEND;

if (backend === 'koffi') {
  binding = require('./koffi-binding');
} else if (backend === 'native') {
  binding = require('@mimersql/node-mimer-native');
} else {
  // Default: try @mimersql/node-mimer-native if installed, otherwise Koffi
  try {
    binding = require('@mimersql/node-mimer-native');
  } catch {
    binding = require('./koffi-binding');
  }
}

module.exports = binding;
