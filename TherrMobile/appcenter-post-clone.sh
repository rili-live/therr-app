#!/usr/bin/env bash

# Install parent node_modules one directory above the current directory
# npm install --prefix ../ ../

echo "----------------------"
echo "Installing root level dependencies"
echo "----------------------"
pushd ../
npm install
popd

echo "----------------------"
echo "Installing therr library styles"
echo "----------------------"
pushd ../therr-public-library/therr-styles
npm install
npm run build
popd

echo "----------------------"
echo "Installing therr js library utilities"
echo "----------------------"
pushd ../therr-public-library/therr-js-utilities
npm install
npm run build
popd

echo "----------------------"
echo "Installing therr library react utilities"
echo "----------------------"
pushd ../therr-public-library/therr-react
npm install
npm run build
popd
