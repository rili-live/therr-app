import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import OctIcon from 'react-native-vector-icons/Octicons';
import buttonStyles from '../../styles/buttons';

interface MapActionButtonsAltProps {
    handleCreateMoment: any;
    handleGpsRecenter: any;
    isAuthorized: any;
    isGpsEnabled: any;
    goToMap?: any;
    goToMoments?: any;
    goToNotifications: any;
}

export default ({
    handleCreateMoment,
    handleGpsRecenter,
    isAuthorized,
    isGpsEnabled,
    goToNotifications,
}: MapActionButtonsAltProps) => {
    const shouldShowCreateButton = isAuthorized() && isGpsEnabled;

    return (
        <>
            <View style={buttonStyles.notifications}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name="notifications"
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => goToNotifications()}
                />
            </View>
            {
                shouldShowCreateButton &&
                    <View style={buttonStyles.addMoment}>
                        <Button
                            buttonStyle={buttonStyles.btn}
                            icon={
                                <OctIcon
                                    name="device-camera"
                                    size={44}
                                    style={buttonStyles.btnIcon}
                                />
                            }
                            raised={true}
                            onPress={handleCreateMoment}
                        />
                    </View>
            }
            <View style={buttonStyles.locationEnable}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name={ isGpsEnabled ? 'gps-fixed' : 'gps-off' }
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleGpsRecenter}
                />
            </View>
        </>
    );
};
