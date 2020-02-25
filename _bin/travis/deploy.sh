#!/bin/bash

set -e


CURRENT_BRANCH=${TRAVIS_PULL_REQUEST_BRANCH:-$TRAVIS_BRANCH}
echo "Current branch is $CURRENT_BRANCH"

# TRAVIS_BRANCH represents the destination branch for PR builds
if [ ! -z "$TRAVIS_PULL_REQUEST_BRANCH" ]; then
  echo "Destination branch is $TRAVIS_BRANCH"
fi

# Only build the docker images when the source branch is stage or master
if [[ ("$CURRENT_BRANCH" != "stage") && ("$CURRENT_BRANCH" != "master") ]]; then
  echo "Skipping post build stage."
  exit 0
fi

[[ "$CURRENT_BRANCH" = "stage" ]] && SUFFIX="-stage" || SUFFIX=""

docker build -t riliadmin/server-api$SUFFIX:latest -t riliadmin/server-api$SUFFIX:$GIT_SHA -f ./rili-server/Dockerfile.api \
  --build-arg NODE_ENV=production \
  --build-arg NODE_VERSION=${NODE_VERSION} .
docker build -t riliadmin/server-socket$SUFFIX:latest -t riliadmin/server-socket$SUFFIX:$GIT_SHA -f ./rili-server/Dockerfile.socket \
  --build-arg NODE_ENV=production \
  --build-arg NODE_VERSION=${NODE_VERSION} .
docker build -t riliadmin/client-web$SUFFIX:latest -t riliadmin/client-web$SUFFIX:$GIT_SHA -f ./rili-client-web/Dockerfile \
  --build-arg NODE_ENV=production \
  --build-arg NODE_VERSION=${NODE_VERSION} .
docker push riliadmin/server-api$SUFFIX:latest
docker push riliadmin/server-socket$SUFFIX:latest
docker push riliadmin/client-web$SUFFIX:latest
docker push riliadmin/server-api$SUFFIX:$GIT_SHA
docker push riliadmin/server-socket$SUFFIX:$GIT_SHA
docker push riliadmin/client-web$SUFFIX:$GIT_SHA
kubectl apply -f k8s
kubectl set image deployments/server-deployment server=riliadmin/server-api:$GIT_SHA
kubectl set image deployments/client-deployment client=riliadmin/server-socket:$GIT_SHA
kubectl set image deployments/worker-deployment worker=riliadmin/client-web:$GIT_SHA