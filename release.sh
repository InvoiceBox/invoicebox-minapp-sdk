#!/bin/bash

git checkout develop &&

# clean
find ./cjs -mindepth 1 ! -regex '\(^\.\/cjs\/package\.json$\)\|\(^\.\/cjs\/\.gitignore$\)' -delete &&
rm -rf ./esm &&

# build
./node_modules/.bin/tsc --project tsconfig.esm.json &&
./node_modules/.bin/tsc --project tsconfig.cjs.json &&
./node_modules/.bin/uglifyjs cjs/index.js > cjs/index.min.js

# up version
npm version $VERSION &&
git push &&
git push --tags &&

# merge to master and publish to npm
git checkout main && 
git merge develop && 
git push && 
npm publish && 

git checkout develop
