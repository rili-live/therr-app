import * as React from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import OctIcon from 'react-native-vector-icons/Octicons';
import buttonStyles from '../../styles/buttons';

export type ICreateMomentAction = 'camera' | 'upload' | 'text-only';

interface MapActionButtonsAltProps {
    handleCreateMoment: (action: ICreateMomentAction) => any;
    handleGpsRecenter: any;
    hasNotifications: boolean;
    toggleMomentActions: Function;
    isAuthorized: any;
    isGpsEnabled: any;
    translate: Function;
    goToMap?: any;
    goToMoments?: any;
    goToNotifications: any;
    shouldShowCreateActions: boolean;
}

export default ({
    handleCreateMoment,
    handleGpsRecenter,
    toggleMomentActions,
    hasNotifications,
    isAuthorized,
    isGpsEnabled,
    translate,
    goToNotifications,
    shouldShowCreateActions,
}: MapActionButtonsAltProps) => {
    const shouldShowCreateButton = isAuthorized() && isGpsEnabled;

    return (
        <>
            <View style={buttonStyles.notifications}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name={ hasNotifications ? 'notifications-active' : 'notifications' }
                            size={28}
                            style={hasNotifications ? buttonStyles.btnIconBright : buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => goToNotifications()}
                />
            </View>
            {
                shouldShowCreateButton &&
                    <>
                        <View style={buttonStyles.addAMoment}>
                            <Button
                                buttonStyle={buttonStyles.btnLarge}
                                icon={
                                    <OctIcon
                                        name={ shouldShowCreateActions ? 'dash' : 'plus' }
                                        size={36}
                                        style={buttonStyles.btnIcon}
                                    />
                                }
                                raised={true}
                                onPress={() => toggleMomentActions()}
                            />
                        </View>
                        {
                            shouldShowCreateActions &&
                                <>
                                    {/* <View style={buttonStyles.claimASpace}>
                                        <Text style={buttonStyles.labelLeft}>{translate('menus.mapActions.claimASpace')}</Text>
                                        <Button
                                            buttonStyle={buttonStyles.btnMedium}
                                            icon={
                                                <FontAwesome5Icon
                                                    name="map-marked"
                                                    size={24}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('space')}
                                        />
                                    </View> */}
                                    <View style={buttonStyles.shareAThought}>
                                        <Text style={buttonStyles.labelLeft}>{translate('menus.mapActions.shareAThought')}</Text>
                                        <Button
                                            buttonStyle={buttonStyles.btnMedium}
                                            icon={
                                                <OctIcon
                                                    name="megaphone"
                                                    size={24}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('text-only')}
                                        />
                                    </View>
                                    <View style={buttonStyles.uploadMoment}>
                                        <Text style={buttonStyles.labelLeft}>{translate('menus.mapActions.uploadAMoment')}</Text>
                                        <Button
                                            buttonStyle={buttonStyles.btnMedium}
                                            icon={
                                                <FontAwesome5Icon
                                                    name="gem"
                                                    size={24}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('upload')}
                                        />
                                    </View>
                                    <View style={buttonStyles.captureMoment}>
                                        <Text style={buttonStyles.labelLeft}>{translate('menus.mapActions.captureAMoment')}</Text>
                                        <Button
                                            buttonStyle={buttonStyles.btnMedium}
                                            icon={
                                                <OctIcon
                                                    name="device-camera"
                                                    size={24}
                                                    style={buttonStyles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('camera')}
                                        />
                                    </View>
                                </>
                        }
                    </>
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
