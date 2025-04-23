#!/bin/bash

if [ "$#" -eq 1 ]; then
    ../node_modules/ts-node/dist/bin.js $1
else
    echo "usage: ./run.sh <filename.ts>"
fi