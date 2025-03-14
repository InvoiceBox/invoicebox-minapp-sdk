#!/bin/bash
set -e  # Stop script on any error

echo "Cleaning..."
mkdir -p ../cjs
mkdir -p ../esm

find ../cjs -type f ! -name ".gitignore" ! -name "package.json" -delete 2>/dev/null || true
find ../cjs -mindepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
rm -rf ../esm/* 2>/dev/null || true

echo "Building..."
../node_modules/.bin/tsc --project ../tsconfig.esm.json
../node_modules/.bin/tsc --project ../tsconfig.cjs.json
../node_modules/.bin/uglifyjs ../cjs/index.js > ../cjs/index.min.js

# Verify build files
echo "Verifying build files..."
if [ ! -f "../cjs/index.js" ] || [ ! -f "../esm/index.js" ]; then
  echo "Error: Build files are missing! Check the build process."
  exit 1
fi

echo "Build completed successfully!"
