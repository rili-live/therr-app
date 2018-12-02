# Get color variables for output messages
source ./colorize.sh;

# TODO: Add conditions to prevent bad commits
# Use CHANGEME.json file to verify development changes and re-build respective pages
if [ 1 -eq 1 ]; then
    printMessageNeutral "-- PRE PUSH SUCCESS --"
else
    printMessageError "-- PRE PUSH ERROR --"
    exit 1
fi