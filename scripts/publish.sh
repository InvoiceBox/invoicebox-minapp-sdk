#!/bin/bash
set -e  # Stop script on any error

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
  echo "Error: You must be on the develop branch to release. Current branch: $CURRENT_BRANCH"
  exit 1
fi

echo "Pushing changes (version) and tags to remote..."
git push
git push --tags

echo "Merging to main branch and pushing..."
git checkout main
git merge develop
git push

echo "Package content check:"
cd .. && npm pack --dry-run

read -p "Publish to npm? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Publish cancelled. Returning to develop branch."
  git checkout develop
  exit 1
fi

echo "Publishing to npm..."
npm publish --tag latest

git checkout develop

echo "Release completed successfully!"
