# Steps to Setup a Niche App

These niche apps are a branch and/or child app of Therr App. The general idea is for a niche app to inherit the core foundations of Therr with unique, niche branding, content filtering specific to that branding, and some simple customizations that are controlled by feature flags.

To use this page as a checklist, make a copy of this file.

## Domain Name & Landing Page Setup

1. Buy a domain name (preferably through Google Cloud DNS)
2. Update the Godaddy config to point nameservers to Google Cloud
3. Update the DNS on Google Cloud by creating a new zone and DNS record
4. Install wordpress and configure the domain name to point to it. We have an EC2 instance on AWS where the landing pages for Therr app and Therr for Business are installed. There is also a MySQL database in the account. Credentials are stored in LastPass.
   - Mysql username: `admin`
   - Create a new database like `wordpress_<YOUR_NICHE>`
   - Use the `%` wildcard in place of localhost
     - ie.) `CREATE USER 'wordpressuser'@'%' IDENTIFIED BY 'password';`
     - ie.) `GRANT ALL ON wordpress.* TO 'wordpressuser'@'%';`
5. Create new dir `mkdir /var/www/newdomain.com` with your new domain name
6. Create a duplicate of the nginx configuration file `sudo cp /etc/nginx/sites-available/business.therr.com /etc/nginx/sites-available/newdomain.com`
7. Enter edit mode `vim /etc/nginx/sites-available/newdomain.com`
8. Find and replace the domain name `:%s/business.therr.com/newdomain.com/g`
9. Use certbot to create https cert
   - Reference: https://spinupwp.com/hosting-wordpress-yourself-setting-up-sites/
10. Finally symlink to sites-enabled and restart nginx
11. Use this tutorial for reference: https://www.digitalocean.com/community/tutorials/how-to-install-wordpress-with-lemp-on-ubuntu-22-04
12. Create an email and configure identity in AWS SES with DNS
    - Emails can be created with google workspaces or zoho.com (ie. info@teem-social.com)
    - Add the identity through AWS SES and follow the steps to verify DNS in Google Cloud DNS
    - Update hostContext to use new email

## Mobile App Setup (ex. Uses Teem for demonstration)

### Configuration Updates (commit to "general" branch)

Add config entries to the following files:

- `therr-public-library/therr-js-utilities/src/constants/enums/Branding.ts`
- `therr-services/push-notifications-service/src/api/firebaseAdmin.ts`
- `therr-services/users-service/src/constants/hostContext.ts`
  - Update the `getHostContext()` function to recognize the host
- `therr-client-web-dashboard/src/utilities/getHostContext.ts`
- `therr-public-library/therr-js-utilities/src/constants/enums/PushNotifications.ts`

### App Renaming

1. Create a new branch from general with format similar to `niche/TEEM-general`
2. Run the following command and replace with your new app name (ex. Teem):
```
   npx react-native-rename "Teem" -b "com.therr.mobile.Teem"
```
3. `npm run android:clean`
4. `npm run clean`
5. Rename `Therr_Debug.xcscheme` and `Therr_Release.xcscheme` to `Teem_Debug.xcscheme` and `Teem_Release.xcscheme` then find and replace occurrences in Podfile
6. Rename `TherrTests-Bridging-Header.h` to `TeemTests-Bridging-Header.h`
7. `npm run ios:clean`
8. Open the project in xcode and wait for it to index then run "clean build". Target the simulator device and try to run the build

### Additional Configuration (commit to "niche" branch)

Add config entries to the following files:

- `TherrMobile/index.js`
- `TherrMobile/main/socket-io-middleware.ts`
- `TherrMobile/main/components/Layout.tsx`
- `TherrMobile`

### Branding & Assets

1. Create new app icons
   - One option is to use npm app-icon https://www.npmjs.com/package/app-icon
   - You could also use Android Studio to create an adaptive icon
2. Import the existing file, `therr-font-config.json` into icomoon and add new icons
3. Look for occurrences of "therr-logo" in the app to replace the logo in the top left corner of the app header. Customize as needed

### Translations & Content

1. Update the translations files and replace occurrences of "Therr" with the new app name
2. Also update the urls to reference the new app website/landing page
3. Search for `therr.app` and replace urls like the link to the privacy policy
4. `TherrMobile/main/routes/Map/EULA.ts` has a hard coded terms of service that should probably be moved to translations
   - Replace "Therr" with new app name
5. `TherrMobile/main/locales/en-us/dictionary.json`
   - Do this for all locales
   - Update verbiage to match branding

### Additional Setup

1. Handle new intent IDs for backend push notifications and app links
   - Ex. `com.therr.mobile.CREATE_YOUR_PROFILE_REMINDER`
2. Add link to associated domains in xcode

## TODO

**NOTE: Untracked git files (maybe deploy only change)**

- `Google-services.json` for Google Cloud api keys that will work with the new bundle identifier
- also `GoogleService-info.plist`
- Find way to implement single sign-on for the new app name/url
- Store user brandVariation and add brandVariation filters to scheduled processes