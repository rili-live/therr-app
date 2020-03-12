#!/bin/bash

set -e

# openssl aes-256-cbc -K $encrypted_0c35eebf403c_key -iv $encrypted_0c35eebf403c_iv -in service-account.json.enc -out service-account.json -d
# curl https://sdk.cloud.google.com | bash > /dev/null;
# source $HOME/google-cloud-sdk/path.bash.inc
# gcloud components update kubectl
# gcloud auth activate-service-account --key-file service-account.json
# gcloud config set project kubernetes-multi-261618
# gcloud config set compute/zone us-central1-a
# gcloud container clusters get-credentials multi-cluster
echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
docker build -t riliadmin/testing -f ./client/Dockerfile.dev ./client