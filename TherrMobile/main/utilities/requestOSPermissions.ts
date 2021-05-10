import {
    PermissionsAndroid,
    Platform,
} from 'react-native';
import {
    requestMultiple,
    PERMISSIONS,
} from 'react-native-permissions';

const requestAndroidPermission = (requestedPermissions: any[], storePermissionsResponse) => PermissionsAndroid.requestMultiple(requestedPermissions)
    .then((grantedPermissions) => {
        storePermissionsResponse(grantedPermissions);
        return grantedPermissions;
    });

const requestIOSPermissions = (requestedPermissions: any[], storePermissionsResponse) => requestMultiple(requestedPermissions)
    .then((grantedPermissions) => {
        storePermissionsResponse(grantedPermissions);
        return grantedPermissions;
    });

const requestOSCameraPermissions = (storePermissionsResponse) => {
    switch (Platform.OS) {
        case 'ios':
            return requestIOSPermissions([
                PERMISSIONS.IOS.CAMERA,
            ], storePermissionsResponse);
        case 'android':
            return requestAndroidPermission([
                PermissionsAndroid.PERMISSIONS.CAMERA,
                PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            ], storePermissionsResponse);
        default:
            return Promise.reject();
    }
};

const requestOSMapPermissions = (storePermissionsResponse) => {
    switch (Platform.OS) {
        case 'ios':
            return requestIOSPermissions([
                PERMISSIONS.IOS.LOCATION_ALWAYS,
                PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
            ], storePermissionsResponse);
        case 'android':
            return requestAndroidPermission([
                PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ], storePermissionsResponse);
        default:
            return Promise.reject();
    }
};

export {
    requestOSCameraPermissions,
    requestOSMapPermissions,
};
