# Development of node-mimer

Some workflows of node-mimer



## Creating a package to publish

The package published will contain prebuilt .node binaries for supported platforms in the prebuilds directory.

To build these prebuilt libraries we work on different platforms and copy the result to the prebuilds directory.

### Linux

On Linux we will build binaries for Linux x64 and Linux ARM64. These are put in prebuilds/linux-arm6 and prebuilds/linux-x64.

Since this will cross compile the .node file for ARM64 we need the toolchain for that and libmimerapi.so for ARM64.

- `mkdir -p platform_lib/linux-arm64`
- `cp /path/to/arm64/libmimerapi.so platform_lib/linux-arm64/`
- `npm run prebuild-linux`

Note that platform_lib/ is only needed at build time — it shouldn't be published.

### macOS

On macOS we build both for ARM64 and x64:
```
npm run prebuild-macos
```

### Windows

On Windows we build for x64:
```
npm run prebuild
```

### Collecting prebuilds

After building on each platform, copy the `prebuilds/` directories to a single
machine. The final `prebuilds/` directory should contain:

```
prebuilds/
  linux-x64/@mimersql+node-mimer.node
  linux-arm64/@mimersql+node-mimer.node
  darwin-x64/@mimersql+node-mimer.node
  darwin-arm64/@mimersql+node-mimer.node
  win32-x64/@mimersql+node-mimer.node
```

Verify each binary with `file prebuilds/*/*.node`.

## Publishing to npm

### Pre-flight checks

1. Make sure all prebuilds are in place:
   ```
   ls prebuilds/*/
   ```

2. Run tests to verify everything works:
   ```
   npm test
   ```

3. Check what will be included in the package:
   ```
   npm pack --dry-run
   ```
   Verify that `prebuilds/` are included and no unwanted files (tests, docs,
   platform_lib/) are shipped. The `files` field in `package.json` controls this.

4. Bump the version in `package.json`:
   ```
   npm version patch    # 1.0.1 → 1.0.2
   npm version minor    # 1.0.1 → 1.1.0
   npm version major    # 1.0.1 → 2.0.0
   ```
   Or edit `package.json` manually.

### Publishing

```
npm publish --access public
```

The `--access public` flag is required for scoped packages (`@mimersql/...`).
After the first publish, subsequent publishes do not need `--access public`,
but it doesn't hurt to include it.

### Verify the published package

```
npm info @mimersql/node-mimer
npm pack @mimersql/node-mimer --dry-run
```

### Important notes

- npm does not allow republishing the same version. Always bump the version
  before publishing.
- The `prebuilds/` directory is included in the npm package via the `files`
  field in `package.json`.
- `platform_lib/`, `test/`, `doc/`, `build/`, and `node_modules/` are **not**
  shipped — they are either gitignored or not listed in `files`.
- If you need to unpublish a version, you can only do so within 72 hours:
  ```
  npm unpublish @mimersql/node-mimer@1.0.2
  ```
