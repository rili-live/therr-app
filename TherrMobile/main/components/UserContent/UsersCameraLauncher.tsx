
import React from 'react';
// import {
//     PermissionsAndroid,
//     Platform,
//     View,
// } from 'react-native';
import { Button } from 'react-native-elements';
import * as ImagePicker from 'react-native-image-picker';
import { requestOSCameraPermissions } from '../../utilities/requestOSPermissions';

interface IUsersImagePickerProps {
    callback?: ImagePicker.Callback;
    translate: Function;
    updateLocationPermissions: Function;
}

export default class UsersImagePicker extends React.Component<IUsersImagePickerProps> {
    constructor(props: IUsersImagePickerProps) {
        super(props);

        this.state = {};
    }

    handleImageSelect = (response) => {
        const { callback } = this.props;
        console.log(response);

        callback && callback(response);
    }

    handlePress = () => {
        const storePermissions = () => {};

        return requestOSCameraPermissions(storePermissions).then(() => ImagePicker.launchCamera(
            {
                mediaType: 'photo',
                includeBase64: false,
                maxHeight: 200,
                maxWidth: 200,
            },
            this.handleImageSelect,
        )).catch(() => {
            // Handle Permissions denied
        });
    }

    render() {
        const { translate } = this.props;

        return (
            <Button
                title={translate('components.imagePicker.camera')}
                onPress={this.handlePress}
            />
        );
    }
}
