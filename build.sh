#!/bin/bash

# clean
find ./cjs -mindepth 1 ! -regex '\(^\.\/cjs\/package\.json$\)\|\(^\.\/cjs\/\.gitignore$\)' -delete &&
rm -rf ./esm &&

# build
./node_modules/.bin/tsc --project tsconfig.esm.json &&
./node_modules/.bin/tsc --project tsconfig.cjs.json &&
./node_modules/.bin/minify cjs/index.js > cjs/index.min.js
