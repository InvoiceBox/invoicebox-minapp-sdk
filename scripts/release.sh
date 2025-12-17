#!/bin/bash
set -e  # Stop script on any error

echo "Step 1/5: Check current branch"
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
  echo "Error: You must be on the develop branch to release. Current branch: $CURRENT_BRANCH"
  exit 1
fi

echo "Step 2/5: Update main and merge into current branch"
git fetch origin
git checkout main
git pull origin main
git checkout develop
git merge main

echo "Step 3/5: Running build"
./build.sh

echo "Step 4/5: Version management"
read -p "Do you want to bump/change the version? (y - yes, n - skip/retry publish): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  VERSION_ARG=""
  if [ ! -z "$1" ]; then
    VERSION_ARG="$1"
  fi

  ./bump-version.sh $VERSION_ARG
else
  CURRENT_VERSION=$(node -p "require('../package.json').version")
  echo "Skipping version bump. Will publish current version: $CURRENT_VERSION"
fi

echo "Step 5/5: Releasing to git and npm"
./publish.sh

echo "Release completed successfully!"
