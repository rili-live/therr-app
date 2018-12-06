set -e

# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# TODO: Add conditions to prevent bad commits
# Use CHANGEME.json file to verify development changes and re-build respective pages
if [ 1 -eq 1 ]; then
    printMessageNeutral "-- PRE COMMIT SUCCESS --"
else
    printMessageError "-- PRE COMMIT ERROR --"
    exit 1
fi