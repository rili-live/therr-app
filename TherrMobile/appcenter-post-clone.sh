#!/usr/bin/env bash

# Install parent node_modules one directory above the current directory
# npm install --prefix ../ ../

cd ../
ls
npm install

cd therr-public-libary/therr-styles
npm install

cd ../../therr-public-libary/therr-js-utilities
npm install

cd ../../therr-public-libary/therr-react
npm install

cd ../../TherrMobile