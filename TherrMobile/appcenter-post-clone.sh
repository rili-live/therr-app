#!/usr/bin/env bash

# Install parent node_modules one directory above the current directory
# npm install --prefix ../ ../

echo "----------------------"
echo "Installing root level dependencies"
echo "----------------------"
pushd ../
npm install
popd

echo "----------------------"
echo "Installing therr library styles"
echo "----------------------"
pushd ../therr-public-library/therr-styles
npm install
npm run build
popd

echo "----------------------"
echo "Installing therr js library utilities"
echo "----------------------"
pushd ../therr-public-library/therr-js-utilities
npm install
npm run build
popd

echo "----------------------"
echo "Installing therr library react utilities"
echo "----------------------"
pushd ../therr-public-library/therr-react
npm install
npm run build
popd

echo "----------------------"
echo "Configuring google-services.json"
echo "----------------------"
touch android/app/google-services.json
cat <<EOT >> android/app/google-services.json
{
  "project_info": {
    "project_number": "718962923226",
    "project_id": "therr-app",
    "storage_bucket": "therr-app.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:718962923226:android:04ac3a79bde5e0293077e3",
        "android_client_info": {
          "package_name": "app.therrmobile"
        }
      },
      "oauth_client": [
        {
          "client_id": "718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com",
          "client_type": 3
        }
      ],
      "api_key": [
        {
          "current_key": "$GOOGLE_MAPS_API_KEY"
        }
      ],
      "services": {
        "appinvite_service": {
          "other_platform_oauth_client": [
            {
              "client_id": "718962923226-k1ejo7drgp89h7b375ifkda4l1vapevr.apps.googleusercontent.com",
              "client_type": 3
            },
            {
              "client_id": "718962923226-1rhet8adgsvuviutj7ja2006bhcncr87.apps.googleusercontent.com",
              "client_type": 2,
              "ios_info": {
                "bundle_id": "com.therr.mobile.Therr"
              }
            }
          ]
        }
      }
    }
  ],
  "configuration_version": "1"
}
EOT

# Build Signing
cat <<EOT >> android/gradle.properties
MYAPP_UPLOAD_STORE_FILE=therr-prod-release.keystore
MYAPP_UPLOAD_KEY_ALIAS=therr-prod-release-key-alias
MYAPP_UPLOAD_STORE_PASSWORD="${MYAPP_UPLOAD_STORE_PASSWORD}"
MYAPP_UPLOAD_KEY_PASSWORD="${MYAPP_UPLOAD_KEY_PASSWORD}"
EOT
