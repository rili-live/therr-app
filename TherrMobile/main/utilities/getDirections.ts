import {showLocation} from 'react-native-map-link';

interface IGetDirectionsArgs {
    latitude: number;
    longitude: number;
    title?: string;
}

export default ({
    latitude,
    longitude,
    title,
}: IGetDirectionsArgs) => showLocation({
    latitude,
    longitude,
    // sourceLatitude: -8.0870631, // optionally specify starting location for directions
    // sourceLongitude: -34.8941619, // not optional if sourceLatitude is specified
    title: title?.replace(/[^a-zA-Z0-9 ]/g, ''),
    googleForceLatLon: true, // optionally force GoogleMaps to use the latlon for the query instead of the title
    // googlePlaceId: 'ChIJGVtI4by3t4kRr51d_Qm_x58', // optionally specify the google-place-id
    // alwaysIncludeGoogle: true, // optional, true will always add Google Maps to iOS and open in Safari, even if app is not installed (default: false)
    dialogTitle: 'Open in Maps', // optional (default: 'Open in Maps')
    dialogMessage: 'Choose an app for directions', // optional (default: 'What app would you like to use?')
    cancelText: 'Cancel', // optional (default: 'Cancel')
    // appsWhiteList: ['google-maps'], // optionally you can set which apps to show (default: will show all supported apps installed on device)
    // naverCallerName: 'com.therr.mobile.Therr', // to link into Naver Map, provide your appname which is the bundle ID in iOS and applicationId in android.
    // appTitles: { 'google-maps': 'My custom Google Maps title' }, // optionally you can override default app titles
    // app: 'uber',  // optionally specify specific app to use
    // directionsMode: 'walk', // optional, accepted values are 'car', 'walk', 'public-transport' or 'bike'
});
