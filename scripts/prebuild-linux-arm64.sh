#!/bin/bash
# Cross-compile the native addon for Linux ARM64 from a Linux x64 host.
#
# Prerequisites:
#   sudo apt install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu binutils-aarch64-linux-gnu
#
# The ARM64 libmimerapi.so must be placed in platform_lib/linux-arm64/ before running.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PREBUILD_DIR="$PROJECT_DIR/prebuilds/linux-arm64"
OUTPUT_FILE="$PREBUILD_DIR/@mimersql+node-mimer.node"

# Check cross-compiler
if ! command -v aarch64-linux-gnu-gcc &>/dev/null; then
  echo "Error: aarch64-linux-gnu-gcc not found."
  echo "Install with: sudo apt install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu binutils-aarch64-linux-gnu"
  exit 1
fi

# Check ARM64 Mimer library
if [ ! -f "$PROJECT_DIR/platform_lib/linux-arm64/libmimerapi.so" ]; then
  echo "Error: platform_lib/linux-arm64/libmimerapi.so not found."
  echo "Copy the ARM64 libmimerapi.so there before building."
  exit 1
fi

echo "Building native addon for linux-arm64..."
CC=aarch64-linux-gnu-gcc CXX=aarch64-linux-gnu-g++ \
  node-gyp rebuild --arch=arm64 --directory="$PROJECT_DIR"

# Copy and strip
mkdir -p "$PREBUILD_DIR"
cp "$PROJECT_DIR/build/Release/mimer.node" "$OUTPUT_FILE"
aarch64-linux-gnu-strip "$OUTPUT_FILE"

echo "Done: $(file "$OUTPUT_FILE")"

# Rebuild for host platform so build/Release/mimer.node is usable locally
echo "Rebuilding native addon for host platform..."
node-gyp rebuild --directory="$PROJECT_DIR"
