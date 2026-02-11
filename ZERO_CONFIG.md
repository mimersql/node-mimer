# Zero-Configuration Build System

This document explains how node-mimer achieves zero-configuration builds across all platforms.

## Design Philosophy

**Goal:** Developers should be able to build without setting any environment variables or configuration.

**Approach:** Platform-specific intelligent defaults with automatic detection.

```bash
# All platforms - just build
npm run build
```

No environment variables needed. Can still override if needed.

---

## How It Works Per Platform

### Linux

**Standard Locations:**
```
/usr/include/mimerapi.h
/usr/lib/libmimerapi.so
/usr/lib64/libmimerapi.so
/usr/lib/x86_64-linux-gnu/libmimerapi.so
```

**Detection Method:**
- Relies on standard compiler search paths
- No explicit path configuration needed
- GCC/G++ automatically searches `/usr/include` and `/usr/lib*`

**binding.gyp:**
```gyp
"include_dirs": []  # Uses system defaults
"libraries": ["-lmimerapi"]  # Linker finds it automatically
```

---

### macOS

**Standard Locations:**
```
/usr/local/include/mimerapi.h
/usr/local/lib/libmimerapi.dylib
```

**Detection Method:**
- Uses Homebrew/standard macOS conventions
- Compiler automatically searches `/usr/local/include` and `/usr/local/lib`

**binding.gyp:**
```gyp
"include_dirs": []  # Uses system defaults
"libraries": ["-lmimerapi"]  # Linker finds it automatically
```

---

### Windows

Windows requires explicit paths since there are no standard locations for third-party libraries. The build system (`scripts/find-mimer-windows.js`) automatically finds your Mimer SQL installation using the following search order:

#### 1. MIMER_HOME Environment Variable (Highest Priority)

If `MIMER_HOME` is set, it is used directly:
```powershell
$env:MIMER_HOME="D:\CustomPath\MimerSQL"
npm run build
```

#### 2. Windows Registry

Enumerates version subkeys under:
```
HKEY_LOCAL_MACHINE\SOFTWARE\Mimer\Mimer SQL\
```

Each installed version has its own subkey with a `PathName` value:
```
HKEY_LOCAL_MACHINE
└── SOFTWARE
    └── Mimer
        └── Mimer SQL
            ├── 11.0
            │   └── PathName = "C:\Program Files\Mimer SQL Experience 11.0"
            └── 12.0
                └── PathName = "C:\Program Files\Mimer SQL Experience 12.0"
```

The script reads all version subkeys, validates each path, and picks the highest version.

If no registry subkeys exist (e.g. manual installation), the build system falls through to the next step.

#### 3. Program Files Search (Highest Version)

Searches both:
- `C:\Program Files\Mimer SQL Experience *`
- `C:\Program Files (x86)\Mimer SQL Experience *`

Automatically selects the highest version:
- If you have both 11.0 and 12.0 installed, uses 12.0
- If you have 11.0, 11.1, 11.2, uses 11.2

Version numbers are compared numerically (not lexicographically).

#### 4. Default Fallback

If nothing is found above, falls back to:
```
C:\Program Files\Mimer SQL Experience 11.0
```

This will produce a clear build error pointing to the missing files.

#### binding.gyp Integration

```gyp
"variables": {
  "mimer_home": "<!(node scripts/find-mimer-windows.js)"
},
"include_dirs": ["<(mimer_home)/dev/include"],
"libraries": ["<(mimer_home)/dev/lib/amd64/mimapi64.lib"]
```

#### Multiple Versions Example

If you have:
- `C:\Program Files\Mimer SQL Experience 11.0`
- `C:\Program Files\Mimer SQL Experience 12.0`

The build system will automatically use **12.0** (highest version).

To force 11.0:
```powershell
$env:MIMER_HOME="C:\Program Files\Mimer SQL Experience 11.0"
npm run build
```

---

## Verification Tool

Run before building to verify Mimer SQL is properly installed:

```bash
npm run check-mimer
```

**Output Example (Linux):**
```
=== Mimer SQL Installation Check ===

Checking Mimer SQL on Linux...

Found: /usr/include/mimerapi.h
Found: /usr/lib64/libmimerapi.so

========================================
Mimer SQL is properly installed
  You can now run: npm run build
```

**Output Example (Windows):**
```
=== Mimer SQL Installation Check ===

Checking Mimer SQL on Windows...

Detected MIMER_HOME: C:\Program Files\Mimer SQL Experience 12.0

Found: C:\Program Files\Mimer SQL Experience 12.0\dev\include\mimerapi.h
Found: C:\Program Files\Mimer SQL Experience 12.0\dev\lib\amd64\mimapi64.lib
Found: C:\Program Files\Mimer SQL Experience 12.0\bin\mimapi64.dll

========================================
Mimer SQL is properly installed
  You can now run: npm run build
```

---

## Override Mechanisms

Sometimes you need to override auto-detection:

### Linux/macOS (Custom Installation)

```bash
# Set custom paths during build
export CPLUS_INCLUDE_PATH=/custom/path/include
export LIBRARY_PATH=/custom/path/lib
npm run build
```

### Windows (Custom Installation)

```powershell
# Set MIMER_HOME to override auto-detection
$env:MIMER_HOME="D:\CustomPath\MimerSQL"
npm run build
```

---

## Troubleshooting

### "Mimer SQL not found" Error

**Solution 1: Install Mimer SQL**
Download from https://developer.mimer.com

**Solution 2: Set MIMER_HOME (Windows)**
```powershell
$env:MIMER_HOME="C:\Path\To\Your\MimerSQL"
```

**Solution 3: Verify Installation**

Linux:
```bash
ls /usr/include/mimerapi.h
ls /usr/lib/libmimerapi.so
```

Windows:
```powershell
dir "$env:ProgramFiles\Mimer SQL Experience 11.0\dev\include\mimerapi.h"
dir "$env:ProgramFiles\Mimer SQL Experience 11.0\dev\lib\amd64\mimapi64.lib"
```

### Custom Installation Location (Windows)

If Mimer SQL is installed outside Program Files:
```powershell
$env:MIMER_HOME="D:\Software\MimerSQL"
npm run build
```

---

## Future Enhancements

Potential improvements:

1. **Linux Package Detection:** Query package manager to find Mimer SQL
   ```bash
   dpkg -L mimerapi | grep include
   rpm -ql mimerapi | grep include
   ```

2. **macOS Homebrew Detection:** Check brew installation
   ```bash
   brew --prefix mimerapi
   ```

3. **Cache Detection Results:** Store found paths to speed up rebuilds
