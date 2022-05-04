import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import OctIcon from 'react-native-vector-icons/Octicons';
import { ITherrThemeColors } from '../../styles/themes';

export type ICreateAction = 'camera' | 'upload' | 'text-only' | 'claim' | 'moment';

interface MapActionButtonsProps {
    handleCreate: (action: ICreateAction) => any;
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
    handleCreate,
    handleGpsRecenter,
    toggleMomentActions,
    // hasNotifications,
    isAuthorized,
    isGpsEnabled,
    translate,
    // goToNotifications,
    shouldShowCreateActions,
    themeButtons,
}: MapActionButtonsProps) => {
    const shouldShowCreateButton = isAuthorized() && isGpsEnabled;

    return (
        <>
            <View style={themeButtons.styles.locationEnable}>
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={themeButtons.styles.btnLarge}
                    icon={
                        <MaterialIcon
                            name={ isGpsEnabled ? 'gps-fixed' : 'gps-off' }
                            size={32}
                            style={themeButtons.styles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleGpsRecenter}
                />
            </View>
            {
                shouldShowCreateButton &&
                    <>
                        <Button
                            containerStyle={themeButtons.styles.addAMoment}
                            buttonStyle={themeButtons.styles.btnLargeWithText}
                            icon={
                                <OctIcon
                                    name={ shouldShowCreateActions ? 'dash' : 'plus' }
                                    size={22}
                                    style={themeButtons.styles.btnIcon}
                                />
                            }
                            title={translate('menus.mapActions.create')}
                            titleStyle={themeButtons.styles.btnLargeTitle}
                            raised={true}
                            onPress={() => toggleMomentActions()}
                        />
                        {
                            shouldShowCreateActions &&
                                <>
                                    <View style={themeButtons.styles.claimASpace}>
                                        {/* <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.claimASpace')}</Text> */}
                                        <Button
                                            containerStyle={themeButtons.styles.btnContainer}
                                            buttonStyle={themeButtons.styles.btnLargeWithText}
                                            icon={
                                                <FontAwesome5Icon
                                                    name="map-marked"
                                                    size={24}
                                                    style={themeButtons.styles.btnIcon}
                                                />
                                            }
                                            iconRight
                                            raised
                                            title={translate('menus.mapActions.claimASpace')}
                                            titleStyle={themeButtons.styles.btnMediumTitle}
                                            onPress={() => handleCreate('claim')}
                                        />
                                    </View>
                                    <View style={themeButtons.styles.uploadMoment}>
                                        <Button
                                            containerStyle={themeButtons.styles.btnContainer}
                                            buttonStyle={themeButtons.styles.btnLargeWithText}
                                            icon={
                                                <FontAwesome5Icon
                                                    name="images"
                                                    size={24}
                                                    style={themeButtons.styles.btnIcon}
                                                />
                                            }
                                            iconRight
                                            raised
                                            title={translate('menus.mapActions.uploadAMoment')}
                                            titleStyle={themeButtons.styles.btnMediumTitle}
                                            onPress={() => handleCreate('moment')}
                                        />
                                    </View>
                                </>
                        }
                    </>
            }
        </>
    );
};
