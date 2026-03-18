#!/bin/bash
# SmartShot — Build script
# Generates a clean ZIP ready to upload to browser stores.
# Usage: bash build.sh

set -e

VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).version)")
OUTPUT="smartshot-v${VERSION}.zip"

echo "Building SmartShot v${VERSION}..."

# Run tests first
echo "Running tests..."
npm test

# Clean previous build
rm -f "$OUTPUT"

# Create ZIP with only files needed by the extension
zip -r "$OUTPUT" . \
  --exclude "node_modules/*" \
  --exclude ".git/*" \
  --exclude "tests/*" \
  --exclude "*.md" \
  --exclude "*.sh" \
  --exclude "package*.json" \
  --exclude ".gitignore" \
  --exclude "*.zip"

echo ""
echo "✓ Built: $OUTPUT ($(du -sh "$OUTPUT" | cut -f1))"
echo ""
echo "Next steps:"
echo "  1. Upload $OUTPUT to Chrome Web Store"
echo "  2. Upload $OUTPUT to Firefox AMO"
echo "  3. Upload $OUTPUT to Edge Add-ons"
