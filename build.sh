#!/bin/bash
set -e  # Stop script on any error

# Build
echo "Cleaning..."
find ./cjs -mindepth 1 ! -regex '\(^\.\/cjs\/package\.json$\)\|\(^\.\/cjs\/\.gitignore$\)' -delete
rm -rf ./esm

echo "Building..."
./node_modules/.bin/tsc --project tsconfig.esm.json
./node_modules/.bin/tsc --project tsconfig.cjs.json
./node_modules/.bin/uglifyjs cjs/index.js > cjs/index.min.js

# Verify build files
echo "Verifying build files..."
if [ ! -f "./cjs/index.js" ] || [ ! -f "./esm/index.js" ]; then
  echo "Error: Build files are missing! Check the build process."
  exit 1
fi

# Check package contents
echo "Checking package contents..."
npm pack --dry-run

echo "Build completed successfully!"
