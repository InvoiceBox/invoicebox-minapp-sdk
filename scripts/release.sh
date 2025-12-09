#!/bin/bash
set -e  # Stop script on any error

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
  echo "Error: You must be on the develop branch to release. Current branch: $CURRENT_BRANCH"
  exit 1
fi

echo "Starting release process..."

echo "Step 1/3: Running build"
./build.sh
if [ $? -ne 0 ]; then
  echo "Build failed. Stopping release process."
  exit 1
fi

echo "Step 2/3: Version management"
read -p "Do you want to bump/change the version? (y - yes, n - skip/retry publish): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  VERSION_ARG=""
  if [ ! -z "$1" ]; then
    VERSION_ARG="$1"
  fi

  ./bump-version.sh $VERSION_ARG

  if [ $? -ne 0 ]; then
    echo "Version bump failed. Stopping release process."
    exit 1
  fi
else
  CURRENT_VERSION=$(node -p "require('../package.json').version")
  echo "Skipping version bump. Will publish current version: $CURRENT_VERSION"
fi

echo "Step 3/3: Releasing to git and npm"
./publish.sh
if [ $? -ne 0 ]; then
  echo "Release failed."
  exit 1
fi

echo "Release completed successfully!"
