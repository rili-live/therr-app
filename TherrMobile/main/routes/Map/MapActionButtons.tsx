import React, { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IUserState } from 'therr-react/types';
import AnimatedLottieView from 'lottie-react-native';
import { ITherrThemeColors } from '../../styles/themes';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import TherrIcon from '../../components/TherrIcon';
import checkIn from '../../assets/coin-wallet.json';
import claimASpace from '../../assets/claim-a-space.json';
import { MIN_TIME_BTW_CHECK_INS_MS, MIN_TIME_BTW_MOMENTS_MS } from '../../constants';
import numberToCurrencyStr from '../../utilities/numberToCurrencyStr';

export type ICreateAction = 'camera' | 'upload' | 'text-only' | 'claim' | 'moment' | 'check-in';

interface MapActionButtonsProps {
    exchangeRate: number;
    filters: {
        filtersAuthor: any[],
        filtersCategory: any[],
        filtersVisibility: any[],
    };
    handleCreate: (action: ICreateAction, isBusinessAccount?: boolean, isCreatorAccount?: boolean) => any;
    handleGpsRecenter: () => any;
    handleOpenMapFilters: () => any;
    hasNotifications: boolean;
    toggleCreateActions: Function;
    toggleFollow: () => any;
    isAuthorized: any;
    isGpsEnabled: boolean;
    isFollowEnabled: boolean;
    nearbySpaces: {
        id: string;
        title: string;
        featuredIncentiveRewardValue?: number;
    }[];
    recentEngagements: {
        [id: string]: {
            spaceId: string;
            engagementType: string;
            timestamp: number;
        }
    }
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
    exchangeRate,
    filters,
    handleCreate,
    handleGpsRecenter,
    handleOpenMapFilters,
    toggleCreateActions,
    toggleFollow,
    // hasNotifications,
    // isAuthorized,
    isGpsEnabled,
    isFollowEnabled,
    nearbySpaces,
    recentEngagements,
    translate,
    // goToNotifications,
    shouldShowCreateActions,
    theme,
    themeButtons,
    themeConfirmModal,
    user,
}: MapActionButtonsProps) => {
    // const shouldShowCreateButton = isAuthorized() && isGpsEnabled;
    const [isModalVisible, setModalVisibility] = useState(false);
    const [isCheckInModalVisible, setCheckInModalVisibility] = useState(false);
    const isBusinessAccount = user.details?.isBusinessAccount;
    const isCreatorAccount = user.details?.isCreatorAccount;
    const onShowModal = () => {
        if (user.details.loginCount && user.details.loginCount < 4) {
            setModalVisibility(true);
        } else {
            handleCreate('claim', isBusinessAccount, isCreatorAccount);
        }
    };
    const onShowCheckInModal = () => {
        setCheckInModalVisibility(true);
    };
    const confirmClaimModal = () => {
        setModalVisibility(false);
        handleCreate('claim', isBusinessAccount, isCreatorAccount);
    };
    const confirmCheckInModal = () => {
        setCheckInModalVisibility(false);
        setTimeout(() => handleCreate('check-in'));
    };
    const validCheckInSpaces = nearbySpaces.filter((space) => {
        return !(recentEngagements[space.id]
            && recentEngagements[space.id].engagementType === 'check-in'
            && Date.now() - recentEngagements[space.id].timestamp < MIN_TIME_BTW_CHECK_INS_MS);
    });
    const validRewardMoments = nearbySpaces.filter((space) => {
        return space?.featuredIncentiveRewardValue && !(recentEngagements[space.id]
            && recentEngagements[space.id].engagementType === 'moment'
            && Date.now() - recentEngagements[space.id].timestamp < MIN_TIME_BTW_MOMENTS_MS);
    });
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
    const renderCheckInImage = () => (
        <AnimatedLottieView
            source={checkIn}
            // resizeMode="cover"
            resizeMode="contain"
            speed={1}
            autoPlay={true}
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
    const checkinValue = numberToCurrencyStr(Math.round((Number(2 * exchangeRate) + Number.EPSILON) * 100) / 100);
    const checkInBusName = validCheckInSpaces?.length > 0 ? validCheckInSpaces[0].title : '';
    const momentRewardValue = validRewardMoments?.length > 0
        ? numberToCurrencyStr(Math.round((Number((validRewardMoments[0].featuredIncentiveRewardValue || 0) * exchangeRate) + Number.EPSILON) * 100) / 100)
        : 0;

    return (
        <>
            {
                isGpsEnabled && <View style={themeButtons.styles.toggleFollow}>
                    <Button
                        containerStyle={themeButtons.styles.btnContainer}
                        buttonStyle={themeButtons.styles.btnMediumSecondary}
                        icon={
                            <TherrIcon
                                name={isFollowEnabled ? 'compass' : 'walking'}
                                size={22}
                                style={themeButtons.styles.btnIcon}
                            />
                        }
                        raised={true}
                        onPress={toggleFollow}
                    />
                </View>
            }
            <View style={themeButtons.styles.locationEnable}>
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={themeButtons.styles.btnLarge}
                    icon={
                        isGpsEnabled ?
                            <TherrIcon
                                name={'map-follow-filled'}
                                size={28}
                                style={themeButtons.styles.btnIcon}
                            /> :
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
            <View style={themeButtons.styles.mapFilters}>
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={themeButtons.styles.btnLarge}
                    icon={
                        <TherrIcon
                            name="filters"
                            size={28}
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
                    {/* <Button
                        containerStyle={themeButtons.styles.btnContainer}
                        buttonStyle={[themeButtons.styles.btnSmall, { backgroundColor: themeButtons.colors.tertiary }]}
                        raised={true}
                        title={filterCount.toString()}
                        onPress={handleOpenMapFilters}
                    /> */}
                    <Badge
                        value={filterCount}
                        badgeStyle={themeButtons.styles.mapFiltersBadge}
                        containerStyle={themeButtons.styles.mapFiltersBadgeContainer}
                        onPress={handleOpenMapFilters}
                    />
                </View>
            }
            <Button
                containerStyle={themeButtons.styles.addAMoment}
                buttonStyle={shouldShowCreateActions ? themeButtons.styles.btnLarge : themeButtons.styles.btnLargeWithText}
                icon={
                    <TherrIcon
                        name={shouldShowCreateActions ? 'minus' : 'plus'}
                        size={22}
                        style={themeButtons.styles.btnIcon}
                    />
                }
                iconRight
                title={shouldShowCreateActions ? null : translate('menus.mapActions.create')}
                titleStyle={themeButtons.styles.btnLargeTitleLeft}
                raised={true}
                onPress={() => toggleCreateActions()}
            />
            {
                !isBusinessAccount && isGpsEnabled && nearbySpaces?.length > 0 &&
                <>
                    {
                        validCheckInSpaces?.length > 0 && !shouldShowCreateActions &&
                        <View style={themeButtons.styles.addACheckInBadge}>
                            <Badge
                                value={`$${checkinValue}`}
                                badgeStyle={themeButtons.styles.checkInRewardsBadge}
                                containerStyle={themeButtons.styles.checkInRewardsBadgeContainer}
                                onPress={onShowCheckInModal}
                            />
                        </View>
                    }
                    <View style={themeButtons.styles.addACheckIn}>
                        <Button
                            containerStyle={themeButtons.styles.btnContainer}
                            buttonStyle={shouldShowCreateActions ? themeButtons.styles.btnLargeWithText : themeButtons.styles.btnLarge}
                            icon={
                                <TherrIcon
                                    // name={isBusinessAccount ? 'road-map' : 'pin-distance'}
                                    name="map-marker-clock"
                                    size={22}
                                    style={themeButtons.styles.btnIcon}
                                />
                            }
                            iconRight
                            raised
                            title={shouldShowCreateActions && translate('menus.mapActions.addACheckIn')}
                            titleStyle={themeButtons.styles.btnLargeTitleLeft}
                            onPress={onShowCheckInModal}
                        />
                    </View>
                </>
            }
            <View style={themeButtons.styles.claimASpace}>
                {/* <Text style={themeButtons.styles.labelLeft}>{translate('menus.mapActions.claimASpace')}</Text> */}
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={shouldShowCreateActions ? themeButtons.styles.btnLargeWithText : themeButtons.styles.btnLarge}
                    icon={
                        <TherrIcon
                            // name={isBusinessAccount ? 'road-map' : 'pin-distance'}
                            name="road-map"
                            size={22}
                            style={themeButtons.styles.btnIcon}
                        />
                    }
                    iconRight
                    raised
                    title={shouldShowCreateActions && translate(isBusinessAccount ? 'menus.mapActions.claimASpace' : 'menus.mapActions.requestASpace')}
                    titleStyle={themeButtons.styles.btnLargeTitleLeft}
                    onPress={onShowModal}
                />
            </View>
            {
                validRewardMoments?.length > 0 && !shouldShowCreateActions &&
                <View style={themeButtons.styles.uploadMomentBadge}>
                    <Badge
                        value={`$${momentRewardValue}`}
                        badgeStyle={themeButtons.styles.momentRewardsBadge}
                        containerStyle={themeButtons.styles.momentRewardsBadgeContainer}
                        onPress={onShowCheckInModal}
                    />
                </View>
            }
            <View style={themeButtons.styles.uploadMoment}>
                <Button
                    containerStyle={themeButtons.styles.btnContainer}
                    buttonStyle={shouldShowCreateActions ? themeButtons.styles.btnLargeWithText : themeButtons.styles.btnLarge}
                    icon={
                        <TherrIcon
                            name="map-marker-plus"
                            size={22}
                            style={themeButtons.styles.btnIcon}
                        />
                    }
                    iconRight
                    raised
                    title={shouldShowCreateActions && translate('menus.mapActions.uploadAMoment')}
                    titleStyle={themeButtons.styles.btnLargeTitleLeft}
                    onPress={() => handleCreate('moment')}
                />
            </View>
            <ConfirmModal
                headerText={isBusinessAccount ? translate('modals.confirmModal.header.claimSpace') : translate('modals.confirmModal.header.requestSpace')}
                isVisible={isModalVisible}
                onCancel={() => setModalVisibility(false)}
                onConfirm={confirmClaimModal}
                renderImage={renderImage}
                text={isBusinessAccount ? translate('modals.confirmModal.body.claimSpace') : translate('modals.confirmModal.body.requestSpace')}
                textConfirm={translate('modals.confirmModal.continue')}
                textCancel={translate('modals.confirmModal.notNow')}
                translate={translate}
                theme={theme}
                themeButtons={themeButtons}
                themeModal={themeConfirmModal}
            />
            <ConfirmModal
                headerText={translate('modals.confirmModal.header.checkIn')}
                isVisible={isCheckInModalVisible}
                onCancel={() => setCheckInModalVisibility(false)}
                onConfirm={confirmCheckInModal}
                renderImage={renderCheckInImage}
                text={translate('modals.confirmModal.body.checkIn')}
                text2={checkInBusName ? translate('modals.confirmModal.body.checkInVisiting', {
                    spaceName: checkInBusName,
                }) : ''}
                textConfirm={translate('modals.confirmModal.checkIn')}
                textCancel={translate('modals.confirmModal.notNow')}
                translate={translate}
                theme={theme}
                themeButtons={themeButtons}
                themeModal={themeConfirmModal}
            />
        </>
    );
};
