node build/server-client.js &
  
cd ../therr-client-web-dashboard && node build/server-client.js &
  
wait -n
  
exit $?
