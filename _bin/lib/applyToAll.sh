set -e

# Get color variables for output messages
source ./lib/colorize.sh;

# The rili-public-library utilities then react-components commands must happen first to ensure cross-package dependencies
pushd rili-public-library/utilities;
    if [ -f package.json ]
    then
        printMessageNeutral "Running command '${1}': rili-public-library/utilities"
        eval $1
    fi
popd
pushd rili-public-library/react-components;
    if [ -f package.json ]
    then
        printMessageNeutral "Running command '${1}': rili-public-library/react-components"
        eval $1
    fi
popd

# Only run command on library if this is a root only operation
if [ "$2" = "rootOnly" ]
then
    printMessageSuccess "'${1}' command run on all Libraries!"
    exit
fi

# Remaining directores to run script in. Order matters.
declare -a arr=("./rili-client-server" "./rili-client-web" "rili-client-mobile")
for i in "${arr[@]}"; do
    pushd ${d}
    if [ -f package.json ]
    then
        printMessageNeutral "Running command '${1}': ${d}"
        eval $1
    fi
    popd
done

printMessageSuccess "'${1}' command run on all Libraries and example UI Apps!"${NC}