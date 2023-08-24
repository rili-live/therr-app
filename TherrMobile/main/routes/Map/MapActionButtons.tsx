import React, { useState } from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IUserState } from 'therr-react/types';
import AnimatedLottieView from 'lottie-react-native';
import { ITherrThemeColors } from '../../styles/themes';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import TherrIcon from '../../components/TherrIcon';
import claimASpace from '../../assets/claim-a-space.json';

export type ICreateAction = 'camera' | 'upload' | 'text-only' | 'claim' | 'moment';

interface MapActionButtonsProps {
    filters: {
        filtersAuthor: any[],
        filtersCategory: any[],
        filtersVisibility: any[],
    };
    handleCreate: (action: ICreateAction) => any;
    handleGpsRecenter: () => any;
    handleOpenMapFilters: () => any;
    hasNotifications: boolean;
    toggleCreateActions: Function;
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
    filters,
    handleCreate,
    handleGpsRecenter,
    handleOpenMapFilters,
    toggleCreateActions,
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
    const isBusinessAccount = user.details?.isBusinessAccount;
    const onShowModal = () => {
        if (user.details.loginCount && user.details.loginCount < 4) {
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
            resizeMode="contain"
            speed={1}
            autoPlay={false}
            loop
            style={themeConfirmModal.styles.graphic}
        />
    );
    let filterCount = 0;
    Object.keys(filters).forEach(key => {
        if (filters[key]?.length && !filters[key][0].isChecked) {
            filterCount += 1;
        }
    });

    return (
        <>
            <View style={themeButtons.styles.locationEnable}>
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={themeButtons.styles.btnLarge}
                    icon={
                        isGpsEnabled ?
                            <TherrIcon
                                name={'map-follow-filled'}
                                size={32}
                                style={themeButtons.styles.btnIcon}
                            /> :
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
            <View style={themeButtons.styles.mapFilters}>
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={themeButtons.styles.btnLarge}
                    icon={
                        <TherrIcon
                            name="filters"
                            size={30}
                            style={themeButtons.styles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleOpenMapFilters}
                />
            </View>
            {
                filterCount > 0 &&
                <View style={themeButtons.styles.mapFiltersCount}>
                    <Button
                        containerStyle={themeButtons.styles.btnContainer}
                        buttonStyle={[themeButtons.styles.btnSmall, { backgroundColor: themeButtons.colors.tertiary }]}
                        raised={true}
                        title={filterCount.toString()}
                        onPress={handleOpenMapFilters}
                    />
                </View>
            }
            {
                shouldShowCreateButton &&
                    <>
                        <Button
                            containerStyle={themeButtons.styles.addAMoment}
                            buttonStyle={themeButtons.styles.btnLargeWithText}
                            icon={
                                <TherrIcon
                                    name={ shouldShowCreateActions ? 'minus' : 'plus' }
                                    size={22}
                                    style={themeButtons.styles.btnIcon}
                                />
                            }
                            title={shouldShowCreateActions ? null : translate('menus.mapActions.create')}
                            titleStyle={themeButtons.styles.btnLargeTitle}
                            raised={true}
                            onPress={() => toggleCreateActions()}
                        />
                        {
                            shouldShowCreateActions &&
                                <>
                                    {
                                        isBusinessAccount &&
                                        <View style={themeButtons.styles.claimASpace}>
                                            {/* <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.claimASpace')}</Text> */}
                                            <Button
                                                containerStyle={themeButtons.styles.btnContainer}
                                                buttonStyle={themeButtons.styles.btnLargeWithText}
                                                icon={
                                                    <TherrIcon
                                                        name="map-marker-user"
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
                                    }
                                    <View style={themeButtons.styles.uploadMoment}>
                                        <Button
                                            containerStyle={themeButtons.styles.btnContainer}
                                            buttonStyle={themeButtons.styles.btnLargeWithText}
                                            icon={
                                                <TherrIcon
                                                    name="map-marker-clock"
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
