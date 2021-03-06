#!/bin/bash

set -e

openssl aes-256-cbc -K $encrypted_9f3b5599b056_key -iv $encrypted_9f3b5599b056_iv -in service-account.json.enc -out service-account.json -d

if [ ! -d $HOME/google-cloud-sdk/bin ]; then
  rm -rf $HOME/google-cloud-sdk;
  curl https://sdk.cloud.google.com | bash > /dev/null;
fi
# This line is critical. We setup the SDK to take precedence in our
# environment over the old SDK that is already on the machine.
source $HOME/google-cloud-sdk/path.bash.inc
gcloud components update kubectl
gcloud auth activate-service-account --key-file service-account.json
gcloud config set project therr-app
gcloud config set compute/zone us-central1-c
gcloud container clusters get-credentials cluster-1
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_ID" --password-stdin
# docker build -t therrapp/testing -f ./client/Dockerfile.dev ./client