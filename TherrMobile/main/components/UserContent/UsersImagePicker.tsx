
import React from 'react';
import { Button } from 'react-native-elements';
import * as ImagePicker from 'react-native-image-picker';

interface IUsersCameraLauncherProps {
    translate: Function;
    callback?: ImagePicker.Callback;
}

export default class UsersCameraLauncher extends React.Component<IUsersCameraLauncherProps> {
    constructor(props: IUsersCameraLauncherProps) {
        super(props);

        this.state = {};
    }

    handleImageCapture = (response) => {
        const { callback } = this.props;

        callback && callback(response);
    }

    render() {
        const { translate } = this.props;

        return (
            <Button
                title={translate('components.imagePicker.title')}
                onPress={() =>
                    ImagePicker.launchImageLibrary(
                        {
                            mediaType: 'photo',
                            includeBase64: false,
                            maxHeight: 200,
                            maxWidth: 200,
                        },
                        this.handleImageCapture,
                    )
                }
            />
        );
    }
}
