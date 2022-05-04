import React, { useState } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import OctIcon from 'react-native-vector-icons/Octicons';
import { IUserState } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';
import ConfirmModal from '../../components/Modals/ConfirmModal';

import claimASpace from '../../assets/claim-a-space.json';
import AnimatedLottieView from 'lottie-react-native';

export type ICreateAction = 'camera' | 'upload' | 'text-only' | 'claim' | 'moment';

interface MapActionButtonsProps {
    handleCreate: (action: ICreateAction) => any;
    handleGpsRecenter: () => any;
    handleOpenMapFilters: () => any;
    hasNotifications: boolean;
    toggleMomentActions: Function;
    isAuthorized: any;
    isGpsEnabled: any;
    translate: Function;
    goToMap?: any;
    goToMoments?: any;
    goToNotifications: any;
    shouldShowCreateActions: boolean;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeConfirmModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    user: IUserState
}

export default ({
    handleCreate,
    handleGpsRecenter,
    handleOpenMapFilters,
    toggleMomentActions,
    // hasNotifications,
    isAuthorized,
    isGpsEnabled,
    translate,
    // goToNotifications,
    shouldShowCreateActions,
    theme,
    themeButtons,
    themeConfirmModal,
    user,
}: MapActionButtonsProps) => {
    const shouldShowCreateButton = isAuthorized() && isGpsEnabled;
    const [isModalVisible, setModalVisibility] = useState(false);
    const onShowModal = () => {
        if (user.details.loginCount && user.details.loginCount < 5) {
            setModalVisibility(true);
        } else {
            handleCreate('claim');
        }
    };
    const confirmClaimModal = () => {
        setModalVisibility(false);
        handleCreate('claim');
    };
    const renderImage = () => (
        <AnimatedLottieView
            source={claimASpace}
            // resizeMode="cover"
            speed={1}
            autoPlay={false}
            loop
            style={themeConfirmModal.styles.graphic}
        />
    );

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
                        <View style={themeButtons.styles.mapFilters}>
                            <Button
                                containerStyle={themeButtons.styles.btnContainer}
                                buttonStyle={themeButtons.styles.btnLarge}
                                icon={
                                    <MaterialIcon
                                        name="tune"
                                        size={32}
                                        style={themeButtons.styles.btnIcon}
                                    />
                                }
                                raised={true}
                                onPress={handleOpenMapFilters}
                            />
                        </View>
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
                            title={shouldShowCreateActions ? null : translate('menus.mapActions.create')}
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
                                            onPress={onShowModal}
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
            <ConfirmModal
                headerText={translate('modals.confirmModal.header.claimSpace')}
                isVisible={isModalVisible}
                onCancel={() => setModalVisibility(false)}
                onConfirm={confirmClaimModal}
                renderImage={renderImage}
                text={translate('modals.confirmModal.body.claimSpace')}
                textConfirm={translate('modals.confirmModal.continue')}
                textCancel={translate('modals.confirmModal.notNow')}
                translate={translate}
                theme={theme}
                themeButtons={themeButtons}
                themeModal={themeConfirmModal}
            />
        </>
    );
};
