import {
    Permission,
    PermissionsAndroid,
    Platform,
} from 'react-native';
import {
    requestMultiple,
    PERMISSIONS,
} from 'react-native-permissions';
import Contacts from 'react-native-contacts';

const makePermissionsUniform = (permissions) => {
    return permissions;
};

const checkAndroidPermission = (requestedPermissions: Permission, storePermissionsResponse) => PermissionsAndroid.check(requestedPermissions)
    .then((isGranted) => {
        storePermissionsResponse({
            [requestedPermissions]: isGranted ? 'granted' : 'never_ask_again',
        });
        return isGranted;
    });

const isLocationPermissionGranted = (permissions) => {
    return (permissions[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === 'granted')
        || (permissions[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === 'granted')
        || permissions[PERMISSIONS.IOS.LOCATION_ALWAYS] === 'granted'
        || permissions[PERMISSIONS.IOS.LOCATION_WHEN_IN_USE] === 'granted';
};

const requestAndroidPermission = (requestedPermissions: any[], storePermissionsResponse) => PermissionsAndroid.requestMultiple(requestedPermissions)
    .then((grantedPermissions) => {
        storePermissionsResponse(makePermissionsUniform(grantedPermissions));
        return grantedPermissions;
    });

const requestIOSPermissions = (requestedPermissions: any[], storePermissionsResponse) => requestMultiple(requestedPermissions)
    .then((grantedPermissions) => {
        storePermissionsResponse(makePermissionsUniform(grantedPermissions));
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

const requestOSContactsPermissions = (storePermissionsResponse) => {
    switch (Platform.OS) {
        case 'ios':
            return Contacts.requestPermission().then((response) => {
                return {
                    [PERMISSIONS.IOS.CONTACTS]: response === 'authorized' ? 'granted' : response,
                };
            });
            // return requestIOSPermissions([
            //     PERMISSIONS.IOS.CONTACTS,
            // ], storePermissionsResponse);
        case 'android':
            return requestAndroidPermission([
                PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
            ], storePermissionsResponse);
        default:
            return Promise.reject();
    }
};

const requestOSMapPermissions = (storePermissionsResponse, useFineAccurracy = true) => {
    switch (Platform.OS) {
        case 'ios':
            return requestIOSPermissions([
                PERMISSIONS.IOS.LOCATION_ALWAYS,
                PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
            ], storePermissionsResponse);
        case 'android':
            return requestAndroidPermission([
                useFineAccurracy ? PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION : PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ], storePermissionsResponse);
        default:
            return Promise.reject();
    }
};

export {
    checkAndroidPermission,
    isLocationPermissionGranted,
    requestOSCameraPermissions,
    requestOSContactsPermissions,
    requestOSMapPermissions,
};
