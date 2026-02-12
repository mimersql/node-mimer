#!/usr/bin/env node
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

/**
 * find-mimer-windows.js
 * Automatically find Mimer SQL installation on Windows
 * 
 * Search order:
 * 1. MIMER_HOME environment variable
 * 2. Windows Registry
 * 3. Program Files (latest version)
 * 4. Default fallback path
 */

const fs = require('fs');
const path = require('path');

// Helper to check if Mimer is installed at path
function isMimerInstalled(mimerPath) {
  if (!mimerPath) return false;
  const headerPath = path.join(mimerPath, 'dev', 'include', 'mimerapi.h');
  return fs.existsSync(headerPath);
}

// Try 1: Use MIMER_HOME environment variable
if (process.env.MIMER_HOME && isMimerInstalled(process.env.MIMER_HOME)) {
  console.log(process.env.MIMER_HOME);
  process.exit(0);
}

// Try 2: Read from Windows Registry
// Mimer SQL stores each version under HKLM\SOFTWARE\Mimer\Mimer SQL\<version>\PathName
// e.g. HKLM\SOFTWARE\Mimer\Mimer SQL\11.0\PathName
// We enumerate all version subkeys and pick the highest version.
if (process.platform === 'win32') {
  try {
    const { execSync } = require('child_process');
    // List all version subkeys under "Mimer SQL"
    const regEnum = 'reg query "HKLM\\SOFTWARE\\Mimer\\Mimer SQL" 2>nul';
    const output = execSync(regEnum, { encoding: 'utf8' });

    const registryVersions = [];
    for (const line of output.split('\n')) {
      // Each subkey line looks like: HKEY_LOCAL_MACHINE\SOFTWARE\Mimer\Mimer SQL\11.0
      const versionMatch = line.match(/Mimer SQL\\(\d+\.\d+)\s*$/);
      if (versionMatch) {
        const version = versionMatch[1];
        try {
          const pathQuery = `reg query "HKLM\\SOFTWARE\\Mimer\\Mimer SQL\\${version}" /v PathName 2>nul`;
          const pathOutput = execSync(pathQuery, { encoding: 'utf8' });
          const pathMatch = pathOutput.match(/PathName\s+REG_SZ\s+(.+)/);
          if (pathMatch && pathMatch[1]) {
            const mimerPath = pathMatch[1].trim();
            if (isMimerInstalled(mimerPath)) {
              registryVersions.push({ version, path: mimerPath });
            }
          }
        } catch (err) {
          // Could not read PathName for this version, skip
        }
      }
    }

    // Sort by version descending and use the highest
    if (registryVersions.length > 0) {
      registryVersions.sort((a, b) => {
        const va = a.version.split('.').map(Number);
        const vb = b.version.split('.').map(Number);
        if (va[0] !== vb[0]) return vb[0] - va[0];
        return vb[1] - va[1];
      });
      console.log(registryVersions[0].path);
      process.exit(0);
    }
  } catch (err) {
    // Registry key not found, continue
  }
}

// Try 3: Find in Program Files - get highest version
const programFiles = [
  process.env.ProgramFiles,
  process.env['ProgramFiles(x86)']
].filter(Boolean);

const foundPaths = [];

for (const pf of programFiles) {
  if (!fs.existsSync(pf)) continue;
  
  try {
    const entries = fs.readdirSync(pf, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('Mimer SQL Experience')) {
        const fullPath = path.join(pf, entry.name);
        if (isMimerInstalled(fullPath)) {
          foundPaths.push({
            path: fullPath,
            name: entry.name,
            // Extract version for sorting (e.g., "11.0" from "Mimer SQL Experience 11.0")
            version: entry.name.match(/(\d+\.\d+)/)?.[1] || '0.0'
          });
        }
      }
    }
  } catch (err) {
    // Permission error or directory doesn't exist, continue
  }
}

// Sort by version (highest first) and return the first one
if (foundPaths.length > 0) {
  foundPaths.sort((a, b) => {
    const versionA = a.version.split('.').map(Number);
    const versionB = b.version.split('.').map(Number);
    
    // Compare major version
    if (versionA[0] !== versionB[0]) {
      return versionB[0] - versionA[0];
    }
    // Compare minor version
    return versionB[1] - versionA[1];
  });
  
  console.log(foundPaths[0].path);
  process.exit(0);
}

// Try 4: Common default locations (in order of preference)
const defaultPaths = [
  'C:\\Program Files\\Mimer SQL Experience 12.0',
  'C:\\Program Files\\Mimer SQL Experience 11.0',
  'C:\\Program Files (x86)\\Mimer SQL Experience 12.0',
  'C:\\Program Files (x86)\\Mimer SQL Experience 11.0'
];

for (const defaultPath of defaultPaths) {
  if (isMimerInstalled(defaultPath)) {
    console.log(defaultPath);
    process.exit(0);
  }
}

// Not found - output a reasonable default that will give a clear error message
console.error('ERROR: Mimer SQL installation not found.');
console.error('Searched:');
console.error('  1. MIMER_HOME environment variable');
console.error('  2. Windows Registry (HKLM\\SOFTWARE\\Mimer\\Mimer SQL\\<version>\\PathName)');
console.error('  3. Program Files directories');
console.error('  4. Default installation paths');
console.error('');
console.error('Please:');
console.error('  1. Install Mimer SQL from https://developer.mimer.com');
console.error('  2. Or set MIMER_HOME environment variable to your installation path');

// Output a default path that will fail gracefully
console.log('C:\\Program Files\\Mimer SQL Experience 11.0');
process.exit(1);
