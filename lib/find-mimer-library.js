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

const fs = require('fs');
const path = require('path');

/**
 * Find the Mimer SQL shared library path for the current platform.
 * Returns the path (or library name for ld search) to load with koffi.load().
 */
function findMimerLibrary() {
  switch (process.platform) {
    case 'linux':
      return 'libmimerapi.so';

    case 'darwin':
      return '/usr/local/lib/libmimerapi.dylib';

    case 'win32':
      return findMimerWindows();

    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

/**
 * Find mimapi64.dll on Windows.
 * Search order: MIMER_HOME → Registry → Program Files scan → defaults.
 */
function findMimerWindows() {
  // Helper to check if a directory contains the Mimer DLL
  function hasDll(dir) {
    if (!dir) return false;
    const dllPath = path.join(dir, 'lib', 'mimapi64.dll');
    return fs.existsSync(dllPath) ? dllPath : null;
  }

  // Try 1: MIMER_HOME environment variable
  if (process.env.MIMER_HOME) {
    const dll = hasDll(process.env.MIMER_HOME);
    if (dll) return dll;
  }

  // Try 2: Windows Registry
  try {
    const { execSync } = require('child_process');
    const regEnum = 'reg query "HKLM\\SOFTWARE\\Mimer\\Mimer SQL" 2>nul';
    const output = execSync(regEnum, { encoding: 'utf8' });

    const registryVersions = [];
    for (const line of output.split('\n')) {
      const versionMatch = line.match(/Mimer SQL\\(\d+\.\d+)\s*$/);
      if (versionMatch) {
        const version = versionMatch[1];
        try {
          const pathQuery = `reg query "HKLM\\SOFTWARE\\Mimer\\Mimer SQL\\${version}" /v PathName 2>nul`;
          const pathOutput = execSync(pathQuery, { encoding: 'utf8' });
          const pathMatch = pathOutput.match(/PathName\s+REG_SZ\s+(.+)/);
          if (pathMatch && pathMatch[1]) {
            const mimerPath = pathMatch[1].trim();
            const dll = hasDll(mimerPath);
            if (dll) {
              registryVersions.push({ version, path: dll });
            }
          }
        } catch (_) { /* skip */ }
      }
    }

    if (registryVersions.length > 0) {
      registryVersions.sort((a, b) => {
        const va = a.version.split('.').map(Number);
        const vb = b.version.split('.').map(Number);
        if (va[0] !== vb[0]) return vb[0] - va[0];
        return vb[1] - va[1];
      });
      return registryVersions[0].path;
    }
  } catch (_) { /* registry not available */ }

  // Try 3: Program Files scan
  const programFiles = [
    process.env.ProgramFiles,
    process.env['ProgramFiles(x86)'],
  ].filter(Boolean);

  const foundPaths = [];
  for (const pf of programFiles) {
    if (!fs.existsSync(pf)) continue;
    try {
      const entries = fs.readdirSync(pf, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('Mimer SQL Experience')) {
          const fullPath = path.join(pf, entry.name);
          const dll = hasDll(fullPath);
          if (dll) {
            foundPaths.push({
              path: dll,
              version: entry.name.match(/(\d+\.\d+)/)?.[1] || '0.0',
            });
          }
        }
      }
    } catch (_) { /* permission error */ }
  }

  if (foundPaths.length > 0) {
    foundPaths.sort((a, b) => {
      const va = a.version.split('.').map(Number);
      const vb = b.version.split('.').map(Number);
      if (va[0] !== vb[0]) return vb[0] - va[0];
      return vb[1] - va[1];
    });
    return foundPaths[0].path;
  }

  // Try 4: Default locations
  const defaultPaths = [
    'C:\\Program Files\\Mimer SQL Experience 12.0',
    'C:\\Program Files\\Mimer SQL Experience 11.0',
  ];
  for (const dp of defaultPaths) {
    const dll = hasDll(dp);
    if (dll) return dll;
  }

  throw new Error(
    'Mimer SQL library not found. Please install Mimer SQL or set MIMER_HOME.'
  );
}

module.exports = findMimerLibrary;
