#!/usr/bin/env node
/**
 * Verify Mimer SQL installation and configuration
 * Run this to check if Mimer SQL can be found before building
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function checkLinux() {
  console.log('Checking Mimer SQL on Linux...\n');
  
  const locations = [
    '/usr/include/mimerapi.h',
    '/usr/lib/libmimerapi.so',
    '/usr/lib64/libmimerapi.so',
    '/usr/lib/x86_64-linux-gnu/libmimerapi.so'
  ];
  
  let found = false;
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      console.log(`✓ Found: ${loc}`);
      found = true;
    }
  }
  
  if (!found) {
    console.log('✗ Mimer SQL not found in standard locations');
    console.log('  Install with: sudo dpkg -i mimerapi_*.deb');
    console.log('  or: sudo rpm -i mimerapi-*.rpm');
    return false;
  }
  
  return true;
}

function checkMacOS() {
  console.log('Checking Mimer SQL on macOS...\n');
  
  const headerPath = '/usr/local/include/mimerapi.h';
  const libPath = '/usr/local/lib/libmimerapi.dylib';
  
  if (!fs.existsSync(headerPath)) {
    console.log(`✗ Header not found: ${headerPath}`);
    console.log('  Install Mimer SQL from https://developer.mimer.com');
    return false;
  }
  console.log(`✓ Found: ${headerPath}`);
  
  if (!fs.existsSync(libPath)) {
    console.log(`✗ Library not found: ${libPath}`);
    console.log('  Install Mimer SQL from https://developer.mimer.com');
    return false;
  }
  console.log(`✓ Found: ${libPath}`);
  
  return true;
}

function checkWindows() {
  console.log('Checking Mimer SQL on Windows...\n');
  
  // Use the same auto-detection logic as binding.gyp
  const findMimer = require('./find-mimer-windows.js');
  
  let mimerHome;
  try {
    mimerHome = require('./find-mimer-windows');
  } catch (e) {
    // Execute the script to get output
    const { execSync } = require('child_process');
    mimerHome = execSync('node scripts/find-mimer-windows.js', { encoding: 'utf8' }).trim();
  }
  
  console.log(`Detected MIMER_HOME: ${mimerHome}\n`);
  
  const headerPath = path.join(mimerHome, 'dev', 'include', 'mimerapi.h');
  const libPath = path.join(mimerHome, 'dev', 'lib', 'amd64', 'mimapi64.lib');
  const dllPath = path.join(mimerHome, 'bin', 'mimapi64.dll');
  
  let allFound = true;
  
  if (!fs.existsSync(headerPath)) {
    console.log(`✗ Header not found: ${headerPath}`);
    allFound = false;
  } else {
    console.log(`✓ Found: ${headerPath}`);
  }
  
  if (!fs.existsSync(libPath)) {
    console.log(`✗ Library not found: ${libPath}`);
    allFound = false;
  } else {
    console.log(`✓ Found: ${libPath}`);
  }
  
  if (!fs.existsSync(dllPath)) {
    console.log(`✗ DLL not found: ${dllPath}`);
    console.log('  (This may cause runtime errors)');
  } else {
    console.log(`✓ Found: ${dllPath}`);
  }
  
  if (!allFound) {
    console.log('\nTo override auto-detection, set MIMER_HOME:');
    console.log('  $env:MIMER_HOME="C:\\Program Files\\Mimer SQL Experience 11.0"');
    return false;
  }
  
  return true;
}

function main() {
  console.log('=== Mimer SQL Installation Check ===\n');
  
  const platform = os.platform();
  let success = false;
  
  if (platform === 'linux') {
    success = checkLinux();
  } else if (platform === 'darwin') {
    success = checkMacOS();
  } else if (platform === 'win32') {
    success = checkWindows();
  } else {
    console.log(`Unsupported platform: ${platform}`);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(40));
  
  if (success) {
    console.log('✓ Mimer SQL is properly installed');
    console.log('  You can now run: npm run build');
    process.exit(0);
  } else {
    console.log('✗ Mimer SQL installation issues detected');
    console.log('  Please install or configure Mimer SQL before building');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkLinux, checkMacOS, checkWindows };
