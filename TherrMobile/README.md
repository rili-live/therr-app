# TeemMobile

## iOS Release Build Tips
`npm run ios:bundle:release`
... wait for this to complete. There is very little output until it is finished.

Open XCode and set the build scheme to Therr_release. Set the provisioning file to develop temporarily. Build on a device and verify that the build works and you can run the app. Update the provisioning profile to distribution, then run the archive.