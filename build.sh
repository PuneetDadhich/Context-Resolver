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
zip -r "${OUTPUT_FILE}" . \
  -x "*.git*" \
  -x "*.DS_Store" \
  -x "store-assets/*" \
  -x "build.sh" \
  -x "README.md" \
  -x "PRIVACY.md" \
  -x "STORE_LISTING.md" \
  -x "LICENSE" \
  -x ".gitignore" \
  -x "context-resolver-*.zip" \
  -x "tests/*" \
  -x "package.json" \
  -x "package-lock.json" \
  -x "node_modules/*"

# Report
SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo ""
echo "✅ Build complete!"
echo "   File: ${OUTPUT_FILE}"
echo "   Size: ${SIZE}"
echo ""
echo "📦 Upload this file to the Chrome Web Store Developer Dashboard:"
echo "   https://chrome.google.com/webstore/devconsole"
