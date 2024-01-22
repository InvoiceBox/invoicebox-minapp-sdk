#!/bin/bash

find ./cjs -mindepth 1 ! -regex '\(^\.\/cjs\/package\.json$\)\|\(^\.\/cjs\/\.gitignore$\)' -delete &&
rm -rf ./esm
