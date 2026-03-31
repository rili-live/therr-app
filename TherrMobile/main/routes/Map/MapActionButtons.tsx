import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { FAB, Badge } from 'react-native-paper';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { IUserState } from 'therr-react/types';
import AnimatedLottieView from 'lottie-react-native';
import {
    AttachStep,
} from 'react-native-spotlight-tour';
import { ITherrThemeColors } from '../../styles/themes';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import TherrIcon from '../../components/TherrIcon';
import checkIn from '../../assets/coin-wallet.json';
import claimASpace from '../../assets/claim-a-space.json';
import { MIN_TIME_BTW_CHECK_INS_MS, MIN_TIME_BTW_MOMENTS_MS } from '../../constants';
import numberToCurrencyStr from '../../utilities/numberToCurrencyStr';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';

const BUTTON_SPACING = 60;
const BASE_BOTTOM = 120;
const COLLAPSE_OFFSET = 20;
const BTN_LARGE_WIDTH = 42;

export type ICreateAction = 'camera' | 'upload' | 'text-only' | 'claim' | 'moment' | 'check-in' | 'event' | 'quick-report';

interface MapActionButtonsProps {
    exchangeRate: number;
    filters: {
        filtersAuthor: any[],
        filtersCategory: any[],
        filtersVisibility: any[],
    };
    handleCreate: (action: ICreateAction, isBusinessAccount?: boolean, isCreatorAccount?: boolean) => any;
    handleGpsRecenter: () => any;
    handleMatchUp: () => any;
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

const renderCompassIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="compass" size={props.size} color={props.color} />
);
const renderWalkingIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="walking" size={props.size} color={props.color} />
);
const renderMapFollowFilledIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="map-follow-filled" size={props.size} color={props.color} />
);
const renderGpsOffIcon = (props: { size: number; color: string }) => (
    <MaterialIcon name="gps-off" size={props.size} color={props.color} />
);
const renderFiltersIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="filters" size={props.size} color={props.color} />
);
const renderBonfireIcon = (props: { size: number; color: string }) => (
    <Ionicons name="bonfire" size={props.size} color={props.color} />
);
const renderMinusIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="minus" size={props.size} color={props.color} />
);
const renderPlusIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="plus" size={props.size} color={props.color} />
);
const renderMapMarkerClockIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="map-marker-clock" size={props.size} color={props.color} />
);
const renderCalendarIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="calendar" size={props.size} color={props.color} />
);
const renderRoadMapIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="road-map" size={props.size} color={props.color} />
);
const renderFlagIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="flag" size={props.size} color={props.color} />
);
const renderMapMarkerPlusIcon = (props: { size: number; color: string }) => (
    <TherrIcon name="map-marker-plus" size={props.size} color={props.color} />
);

const fabStyle = { borderRadius: 100 };

export default ({
    exchangeRate,
    filters,
    handleCreate,
    handleGpsRecenter,
    handleMatchUp,
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
    const hasNearbySpaces = !isBusinessAccount && isGpsEnabled && nearbySpaces?.length > 0;
    const hasValidCheckinSpaces = validCheckInSpaces?.length > 0 && !shouldShowCreateActions;
    const shouldFeatureCheckIn = (hasNearbySpaces && hasValidCheckinSpaces);

    // Dynamic position computation for expanded menu buttons
    // quickReport stays fixed at 120 (static style); other buttons stack above it
    const expandedButtonKeys: string[] = ['createEvent', 'claimASpace', 'uploadMoment'];
    if (hasNearbySpaces && validCheckInSpaces?.length > 0) {
        expandedButtonKeys.push('addACheckIn');
    }
    const getExpandedBottom = (key: string): number => {
        const index = expandedButtonKeys.indexOf(key);
        return BASE_BOTTOM + BUTTON_SPACING + (index * BUTTON_SPACING) + buttonMenuHeight - COLLAPSE_OFFSET;
    };

    return (
        <>
            {
                isGpsEnabled && <View style={themeButtons.styles.toggleFollow}>
                    <FAB
                        icon={isFollowEnabled ? renderCompassIcon : renderWalkingIcon}
                        style={fabStyle}
                        variant="secondary"
                        size="small"
                        onPress={toggleFollow}
                    />
                </View>
            }
            <View style={themeButtons.styles.locationEnable}>
                <AttachStep index={1}>
                    <FAB
                        icon={isGpsEnabled ? renderMapFollowFilledIcon : renderGpsOffIcon}
                        style={fabStyle}
                        variant="secondary"
                        size="small"
                        onPress={handleGpsRecenter}
                    />
                </AttachStep>
            </View>
            <View style={themeButtons.styles.mapFilters}>
                <FAB
                    icon={renderFiltersIcon}
                    variant="secondary"
                    size="small"
                    style={fabStyle}
                    onPress={handleOpenMapFilters}
                />
            </View>
            <View style={themeButtons.styles.matchUp}>
                <AttachStep index={0}>
                    <FAB
                        icon={renderBonfireIcon}
                        style={fabStyle}
                        variant="secondary"
                        size="medium"
                        onPress={handleMatchUp}
                    />
                </AttachStep>
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
                    <Pressable onPress={handleOpenMapFilters} style={themeButtons.styles.mapFiltersBadgeContainer}>
                        <Badge style={themeButtons.styles.mapFiltersBadge}>
                            {filterCount}
                        </Badge>
                    </Pressable>
                </View>
            }
            <View style={themeButtons.styles.addAMoment}>
                <AttachStep index={3}>
                    <FAB
                        icon={shouldShowCreateActions ? renderMinusIcon : renderPlusIcon}
                        style={fabStyle}
                        variant="secondary"
                        size="small"
                        onPress={() => toggleCreateActions()}
                    />
                </AttachStep>
            </View>
            {/* Featured quick-access buttons (collapsed state only) */}
            {
                !shouldShowCreateActions && shouldFeatureCheckIn
                    ? <>
                        <View style={themeButtons.styles.addACheckInBadgeFeatured}>
                            <Pressable onPress={onShowCheckInModal} style={themeButtons.styles.checkInRewardsBadgeContainer}>
                                <Badge style={themeButtons.styles.checkInRewardsBadge}>
                                    {`$${checkinValue}`}
                                </Badge>
                            </Pressable>
                        </View>
                        <View style={themeButtons.styles.addACheckInFeatured}>
                            <FAB
                                icon={renderMapMarkerClockIcon}
                                variant="secondary"
                                size="small"
                                onPress={onShowCheckInModal}
                            />
                        </View>
                    </>
                    : !shouldShowCreateActions && <>
                        {
                            validRewardMoments?.length > 0 &&
                            <View style={themeButtons.styles.uploadMomentBadgeFeatured}>
                                <Pressable onPress={onShowCheckInModal} style={themeButtons.styles.momentRewardsBadgeContainer}>
                                    <Badge style={themeButtons.styles.momentRewardsBadge}>
                                        {`$${momentRewardValue}`}
                                    </Badge>
                                </Pressable>
                            </View>
                        }
                        <View style={themeButtons.styles.uploadMomentFeatured}>
                            <FAB
                                icon={renderMapMarkerPlusIcon}
                                variant="secondary"
                                size="small"
                                style={fabStyle}
                                onPress={() => handleCreate('moment')}
                            />
                        </View>
                    </>
            }
            {/* Quick report: always visible as quick-access; labeled when expanded */}
            <View style={themeButtons.styles.quickReport}>
                <FAB
                    icon={renderFlagIcon}
                    label={shouldShowCreateActions ? translate('menus.mapActions.quickReport') : undefined}
                    variant="secondary"
                    size="small"
                    style={fabStyle}
                    onPress={() => handleCreate('quick-report')}
                />
            </View>
            {/* Expanded menu buttons (only when plus is toggled) */}
            {
                shouldShowCreateActions &&
                <View style={[
                    themeButtons.styles.createEvent,
                    { bottom: getExpandedBottom('createEvent') },
                ]}>
                    <FAB
                        icon={renderCalendarIcon}
                        label={translate('menus.mapActions.createEvent')}
                        variant="secondary"
                        size="small"
                        style={fabStyle}
                        onPress={() => handleCreate('event')}
                    />
                </View>
            }
            {
                shouldShowCreateActions &&
                <View style={[
                    themeButtons.styles.claimASpace,
                    { bottom: getExpandedBottom('claimASpace') },
                ]}>
                    <FAB
                        icon={renderRoadMapIcon}
                        label={translate(isBusinessAccount ? 'menus.mapActions.claimASpace' : 'menus.mapActions.requestASpace')}
                        style={fabStyle}
                        variant="secondary"
                        size="small"
                        onPress={onShowModal}
                    />
                </View>
            }
            {
                shouldShowCreateActions &&
                <View style={[
                    themeButtons.styles.uploadMoment,
                    { bottom: getExpandedBottom('uploadMoment') },
                ]}>
                    <FAB
                        icon={renderMapMarkerPlusIcon}
                        label={translate('menus.mapActions.uploadAMoment')}
                        variant="secondary"
                        size="small"
                        style={fabStyle}
                        onPress={() => handleCreate('moment')}
                    />
                </View>
            }
            {
                shouldShowCreateActions && hasNearbySpaces && validCheckInSpaces?.length > 0 &&
                <>
                    <View style={[
                        themeButtons.styles.addACheckInBadge,
                        { bottom: getExpandedBottom('addACheckIn') + (BTN_LARGE_WIDTH - 10) },
                    ]}>
                        <Pressable onPress={onShowCheckInModal} style={themeButtons.styles.checkInRewardsBadgeContainer}>
                            <Badge style={themeButtons.styles.checkInRewardsBadge}>
                                {`$${checkinValue}`}
                            </Badge>
                        </Pressable>
                    </View>
                    <View style={[
                        themeButtons.styles.addACheckIn,
                        { bottom: getExpandedBottom('addACheckIn') },
                    ]}>
                        <FAB
                            icon={renderMapMarkerClockIcon}
                            label={translate('menus.mapActions.addACheckIn')}
                            variant="secondary"
                            size="small"
                            style={fabStyle}
                            onPress={onShowCheckInModal}
                        />
                    </View>
                </>
            }
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
