#!/bin/bash
set -e  # Stop script on any error

echo "Cleaning..."
# Remove all files from cjs directory except .gitignore and package.json
find ../cjs -type f ! -name ".gitignore" ! -name "package.json" -delete
# Remove all directories inside cjs
find ../cjs -mindepth 1 -type d -exec rm -rf {} +
# Remove esm directory completely
rm -rf ../esm

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
