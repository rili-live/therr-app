import { Platform } from 'react-native';
import LocationServicesDialogBox from 'react-native-android-location-services-dialog-box';

export default ({
    isGpsEnabled,
    translate,
}) => new Promise((resolve, reject) => {
    if (Platform.OS !== 'ios' && !isGpsEnabled) {
        const permissionHeader = translate('permissions.locationGps.header');
        const permissionDescription1 = translate('permissions.locationGps.description1');
        const permissionDescription2 = translate('permissions.locationGps.description2');
        const permissionLink = translate('permissions.locationGps.link');
        const permissionYes = translate('permissions.locationGps.yes');
        const permissionNo = translate('permissions.locationGps.no');
        return LocationServicesDialogBox.checkLocationServicesIsEnabled({
            message:
                `<h2 style='color: #0af13e'>${permissionHeader}</h2>${permissionDescription1}<br/><br/>` +
                `${permissionDescription2}<br/><br/><a href='https://support.google.com/maps/answer/7326816'>${permissionLink}</a>`,
            ok: permissionYes,
            cancel: permissionNo,
            enableHighAccuracy: true, // true => GPS AND NETWORK PROVIDER, false => GPS OR NETWORK PROVIDER
            showDialog: true, // false => Opens the Location access page directly
            openLocationServices: true, // false => Directly catch method is called if location services are turned off
            preventOutSideTouch: false, // true => To prevent the location services window from closing when it is clicked outside
            preventBackClick: false, // true => To prevent the location services popup from closing when it is clicked back button
            providerListener: true, // true ==> Trigger locationProviderStatusChange listener when the location state changes
        })
            .then((success) => {
                return resolve(success);
            }).catch((error) => {
                return reject(error);
            });
    }

    return resolve(null);
});
