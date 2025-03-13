#!/bin/bash
set -e  # Stop script on any error

# Function to determine and suggest a new version
bump_version() {
  # Get current version from package.json
  CURRENT_VERSION=$(node -p "require('../package.json').version")
  echo "Current package version: $CURRENT_VERSION"

  # If version is passed as an argument - use it
  if [ ! -z "$1" ]; then
    NEW_VERSION=$1
    echo "Using provided version: $NEW_VERSION"
    return 0
  fi

  # Split current version into components
  IFS='-' read -ra VER_PARTS <<< "$CURRENT_VERSION"
  MAIN_VERSION=${VER_PARTS[0]}

  if [[ $CURRENT_VERSION == *"-"* ]]; then
    # Has prefix (e.g., alpha, beta)
    PRE_RELEASE=${VER_PARTS[1]}
    IFS='.' read -ra PRE_PARTS <<< "$PRE_RELEASE"
    PRE_TYPE=${PRE_PARTS[0]}
    PRE_NUM=${PRE_PARTS[1]}

    # Increase the last digit
    NEW_PRE_NUM=$((PRE_NUM + 1))
    SUGGESTED_VERSION="$MAIN_VERSION-$PRE_TYPE.$NEW_PRE_NUM"
  else
    # No prefix, regular version
    IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}

    # Increase patch version
    NEW_PATCH=$((PATCH + 1))
    SUGGESTED_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
  fi

  # Offer user a choice
  echo "Suggested new version: $SUGGESTED_VERSION"
  read -p "Use this version? (y - yes, n - enter your own): " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    NEW_VERSION=$SUGGESTED_VERSION
  else
    read -p "Enter desired version: " CUSTOM_VERSION
    NEW_VERSION=$CUSTOM_VERSION
  fi

  echo "Version will be set to: $NEW_VERSION"
  return 0
}

# Determine new version (from argument or user input)
bump_version "$1"

# Update version
npm version $NEW_VERSION
echo "Version updated to $NEW_VERSION"
