#!/bin/bash

VERSION=$(grep '"version"' extension/manifest.json | cut -d'"' -f4)

mkdir -p release
zip -r "release/EasyEDAThemes-v${VERSION}.zip" extension/
echo "Created release/EasyEDAThemes-v${VERSION}.zip"
