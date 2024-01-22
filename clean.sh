#!/bin/bash

find ./cjs -mindepth 1 ! -regex '^\.\/cjs\/package\.json$' -delete &&
rm -rf ./esm
