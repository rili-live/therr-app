import * as React from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import OctIcon from 'react-native-vector-icons/Octicons';
import { ITherrThemeColors } from '../../styles/themes';

export type ICreateMomentAction = 'camera' | 'upload' | 'text-only' | 'claim';

interface MapActionButtonsProps {
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
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
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
    themeButtons,
}: MapActionButtonsProps) => {
    const shouldShowCreateButton = isAuthorized() && isGpsEnabled;

    return (
        <>
            <View style={themeButtons.styles.notifications}>
                <Button
                    buttonStyle={themeButtons.styles.btn}
                    icon={
                        <MaterialIcon
                            name={ hasNotifications ? 'notifications-active' : 'notifications' }
                            size={28}
                            style={hasNotifications ? themeButtons.styles.btnIconBright : themeButtons.styles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => goToNotifications()}
                />
            </View>
            {
                shouldShowCreateButton &&
                    <>
                        <View style={themeButtons.styles.addAMoment}>
                            <Button
                                buttonStyle={themeButtons.styles.btnLarge}
                                icon={
                                    <OctIcon
                                        name={ shouldShowCreateActions ? 'dash' : 'plus' }
                                        size={36}
                                        style={themeButtons.styles.btnIcon}
                                    />
                                }
                                raised={true}
                                onPress={() => toggleMomentActions()}
                            />
                        </View>
                        {
                            shouldShowCreateActions &&
                                <>
                                    <View style={themeButtons.styles.claimASpace}>
                                        <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.claimASpace')}</Text>
                                        <Button
                                            buttonStyle={themeButtons.styles.btnMedium}
                                            icon={
                                                <FontAwesome5Icon
                                                    name="map-marked"
                                                    size={24}
                                                    style={themeButtons.styles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('claim')}
                                        />
                                    </View>
                                    <View style={themeButtons.styles.shareAThought}>
                                        <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.shareAThought')}</Text>
                                        <Button
                                            buttonStyle={themeButtons.styles.btnMedium}
                                            icon={
                                                <OctIcon
                                                    name="megaphone"
                                                    size={24}
                                                    style={themeButtons.styles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('text-only')}
                                        />
                                    </View>
                                    <View style={themeButtons.styles.uploadMoment}>
                                        <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.uploadAMoment')}</Text>
                                        <Button
                                            buttonStyle={themeButtons.styles.btnMedium}
                                            icon={
                                                <FontAwesome5Icon
                                                    name="gem"
                                                    size={24}
                                                    style={themeButtons.styles.btnIcon}
                                                />
                                            }
                                            raised={true}
                                            onPress={() => handleCreateMoment('upload')}
                                        />
                                    </View>
                                    <View style={themeButtons.styles.captureMoment}>
                                        <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.captureAMoment')}</Text>
                                        <Button
                                            buttonStyle={themeButtons.styles.btnMedium}
                                            icon={
                                                <OctIcon
                                                    name="device-camera"
                                                    size={24}
                                                    style={themeButtons.styles.btnIcon}
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
            <View style={themeButtons.styles.locationEnable}>
                <Button
                    buttonStyle={themeButtons.styles.btn}
                    icon={
                        <MaterialIcon
                            name={ isGpsEnabled ? 'gps-fixed' : 'gps-off' }
                            size={28}
                            style={themeButtons.styles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleGpsRecenter}
                />
            </View>
        </>
    );
};
