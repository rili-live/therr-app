#!/usr/bin/env bash

# Install parent node_modules one directory above the current directory
# npm install --prefix ../ ../

pushd ../
npm install
popd 

pushd ../therr-public-libary/therr-styles
npm install
popd

pushd ../therr-public-libary/therr-js-utilities
npm install
popd

pushd ../therr-public-libary/therr-react
npm install
popd
