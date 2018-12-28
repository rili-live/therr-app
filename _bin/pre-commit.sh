# Get color variables for output messages
pushd _bin
source ./lib/colorize.sh
popd

# TODO: Use CHANGEME.json file to verify development changes and re-build respective pages
# Also add valid conditions to ensure good commits
if [ 1 -eq 1 ]; then
    printMessageNeutral "-- PRE COMMIT SUCCESS --"
else
    printMessageError "-- PRE COMMIT ERROR --"
    exit 1
fi