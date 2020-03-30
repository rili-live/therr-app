#!/bin/bash

set -e


openssl aes-256-cbc -K $encrypted_9f3b5599b056_key -iv $encrypted_9f3b5599b056_iv -in service-account.json.enc -out service-account.json -d

if [ ! -d $HOME/google-cloud-sdk/bin ]; then
  # The install script errors if this directory already exists,
  # but Travis already creates it when we mark it as cached.
  rm -rf $HOME/google-cloud-sdk;
  # The install script is overly verbose, which sometimes causes
  # problems on Travis, so ignore stdout.
  curl https://sdk.cloud.google.com | bash > /dev/null;
fi
# This line is critical. We setup the SDK to take precedence in our
# environment over the old SDK that is already on the machine.
source $HOME/google-cloud-sdk/path.bash.inc
gcloud components install kubectl
kubectl version --client
gcloud components update kubectl
kubectl version --client
gcloud auth activate-service-account --key-file service-account.json
gcloud config set project rili-main
gcloud config set compute/zone us-central1-a
gcloud container clusters get-credentials rili-app
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_ID" --password-stdin
# docker build -t riliadmin/testing -f ./client/Dockerfile.dev ./client