#!/bin/bash
# Build script for Chrome Web Store submission
# Creates a .zip file containing only the extension files (no docs, store assets, etc.)

set -e

EXTENSION_NAME="context-resolver"
VERSION=$(grep '"version"' manifest.json | head -1 | sed 's/.*: *"\(.*\)".*/\1/')
OUTPUT_FILE="${EXTENSION_NAME}-v${VERSION}.zip"

echo "🏗️  Building Context Resolver v${VERSION}..."

# Remove old build
rm -f "${OUTPUT_FILE}"

# Create zip with only extension files
zip -r "${OUTPUT_FILE}" \
  manifest.json \
  icons/ \
  background/ \
  sidepanel/ \
  content-scripts/ \
  lib/ \
  styles/ \
  -x "*.DS_Store" \
  -x "*/.DS_Store"

# Report
SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo ""
echo "✅ Build complete!"
echo "   File: ${OUTPUT_FILE}"
echo "   Size: ${SIZE}"
echo ""
echo "📦 Upload this file to the Chrome Web Store Developer Dashboard:"
echo "   https://chrome.google.com/webstore/devconsole"
