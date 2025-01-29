#!/bin/bash

# Start the first process
node build/server-client.js &
  
# Start the second process
cd ../therr-client-web-dashboard && node build/server-client.js &
  
# Wait for any process to exit
wait -n
  
# Exit with status of process that exited first
exit $?
