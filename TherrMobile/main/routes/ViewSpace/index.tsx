import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Dimensions,
    Platform,
    Pressable,
    Share,
    StyleSheet,
    Text,
    View} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button as PaperButton, Text as PaperText } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { showToast } from '../../utilities/toasts';
import { IContentState, IMapState as IMapReduxState, IReactionsState, IUserState } from 'therr-react/types';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { Content, IncentiveRequirementKeys } from 'therr-js-utilities/constants';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import YoutubePlayer from 'react-native-youtube-iframe';
import TherrIcon from '../../components/TherrIcon';
import { ILocationState } from '../../types/redux/location';
import LocationActions from '../../redux/actions/LocationActions';
import translator from '../../utilities/translator';
import { buildSpaceUrl } from '../../utilities/shareUrls';
import { isDarkTheme } from '../../styles/themes';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildMomentStyles } from '../../styles/user-content/areas/viewing';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import userContentStyles from '../../styles/user-content';
import spacingStyles from '../../styles/layouts/spacing';
import { youtubeLinkRegex, MAX_DISTANCE_TO_NEARBY_SPACE } from '../../constants';
import AreaDisplay from '../../components/UserContent/AreaDisplay';
import AreaScrollerCard from '../../components/UserContent/AreaScrollerCard';
import HorizontalCardScroller, { getScrollerCardWidth } from '../../components/UserContent/HorizontalCardScroller';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import SuggestEditModal from '../../components/Modals/SuggestEditModal';
import { CorrectionFieldName } from '../../utilities/correctionValue';
import BaseStatusBar from '../../components/BaseStatusBar';
import { isMyContent as checkIsMySpace, getUserContentUri } from '../../utilities/content';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import { getReactionUpdateArgs } from '../../utilities/reactions';
import getDirections from '../../utilities/getDirections';
import requestLocationServiceActivation from '../../utilities/requestLocationServiceActivation';
import { isLocationPermissionGranted } from '../../utilities/requestOSPermissions';
import getNearbySpaces from '../../utilities/getNearbySpaces';
import { isUserAuthenticated } from '../../utilities/authUtils';

const { width: screenWidth } = Dimensions.get('window');
const pairingCardWidth = getScrollerCardWidth(screenWidth);

const localStyles = StyleSheet.create({
    footer: {
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    footerButton: {
        flex: 1,
        marginHorizontal: 4,
    },
    incentiveButton: {
        marginTop: 8,
    },
    pairingsSection: {
        paddingBottom: 80,
    },
    pairingFeedbackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    pairingFeedbackLink: {
        fontSize: 13,
        fontWeight: '600',
    },
    pairingFeedbackSeparator: {
        fontSize: 13,
        marginHorizontal: 8,
    },
    pairingFeedbackText: {
        fontSize: 13,
    },
});

interface IViewSpaceDispatchProps {
    getSpaceDetails: Function;
    deleteSpace: Function;
    createOrUpdateSpaceReaction: Function;
    updateGpsStatus: Function;
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends IViewSpaceDispatchProps {
    content: IContentState;
    location: ILocationState;
    map: IMapReduxState;
    reactions: IReactionsState;
    user: IUserState;
}

export interface IViewSpaceProps extends IStoreProps {
    navigation: any;
    route: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    location: state.location,
    map: state.map,
    reactions: state.reactions,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    getSpaceDetails: MapActions.getSpaceDetails,
    deleteSpace: MapActions.deleteSpace,
    createOrUpdateSpaceReaction: ContentActions.createOrUpdateSpaceReaction,
    updateGpsStatus: LocationActions.updateGpsStatus,
    updateLocationDisclosure: LocationActions.updateLocationDisclosure,
    updateLocationPermissions: LocationActions.updateLocationPermissions,
}, dispatch);

const ViewSpace = ({
    content,
    location,
    map,
    reactions,
    user,
    navigation,
    route,
    getSpaceDetails,
    deleteSpace,
    createOrUpdateSpaceReaction,
    updateGpsStatus,
    updateLocationDisclosure,
}: IViewSpaceProps) => {
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale]
    );

    // State
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUserInSpace, setIsUserInSpace] = useState(true);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
    const [isViewingIncentives, setIsViewingIncentives] = useState(false);
    const [isSuggestEditModalVisible, setIsSuggestEditModalVisible] = useState(false);
    const [suggestEditInitialField, setSuggestEditInitialField] = useState<CorrectionFieldName | undefined>(undefined);
    const [moments, setMoments] = useState<any[]>([]);
    const [fetchedSpace, setFetchedSpace] = useState<any>({});
    const [previewStyleState, setPreviewStyleState] = useState<any>({});
    const [spacePairings, setSpacePairings] = useState<any[]>([]);
    const [isPairingsLoading, setIsPairingsLoading] = useState(false);
    const [pairingFeedback, setPairingFeedback] = useState<{ [id: string]: boolean }>({});

    // Refs
    const scrollViewRef = useRef<any>(null);

    // Themes
    const theme = buildStyles(user.settings?.mobileThemeName);
    const themeAccentLayout = buildAccentStyles(user.settings?.mobileThemeName);
    const themeArea = buildMomentStyles(user.settings?.mobileThemeName, true);
    const themeForms = buildFormStyles(user.settings?.mobileThemeName);
    const themeConfirmModal = buildConfirmModalStyles(user.settings?.mobileThemeName);
    const themeButtons = buildButtonsStyles(user.settings?.mobileThemeName);
    const isDarkMode = isDarkTheme(user.settings?.mobileThemeName);
    const brandColor = isDarkMode ? theme.colors.textWhite : theme.colors.brandingBlueGreen;

    // Derived values
    const { space, isMyContent, previousView, previewScrollIndex } = route.params;

    const hashtags = useMemo(
        () => (space.hashTags ? space.hashTags.split(',') : []),
        [space.hashTags]
    );

    const notificationMsg = useMemo(
        () => (space.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' '),
        [space.notificationMsg]
    );

    const previewLinkId = useMemo(() => {
        const youtubeMatches = (space.message || '').match(youtubeLinkRegex);
        return youtubeMatches && youtubeMatches[1];
    }, [space.message]);

    const spaceInView = useMemo(() => ({
        ...space,
        ...fetchedSpace,
        areaType: 'spaces',
        associatedMoments: moments,
    }), [space, fetchedSpace, moments]);

    // The route param is set by the caller; re-derive from the fetched space too,
    // since a space reached via a share link or a pairing card arrives without it.
    const isMySpace = isMyContent || checkIsMySpace(spaceInView, user);

    const spaceUserName = isMyContent ? user.details.userName : spaceInView.fromUserName;
    const spaceUserMedia = isMyContent ? user.details.media : (spaceInView.fromUserMedia || {});
    const spaceUserIsSuperUser = isMyContent ? user.details.isSuperUser : (spaceInView.fromUserIsSuperUser || {});

    const mediaPath = spaceInView.medias?.[0]?.path;
    const mediaType = spaceInView.medias?.[0]?.type;
    const spaceMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(spaceInView.medias?.[0], screenWidth, screenWidth)
        : content?.media[mediaPath];

    let areaUserName = spaceUserName || translate('alertTitles.nameUnknown');
    if (areaUserName === 'therr_it_is') {
        areaUserName = translate('alertTitles.nameUnknown');
    }

    useEffect(() => {
        const shouldFetchUser = !space?.fromUserMedia || !space.fromUserName;
        const mPath = space?.medias?.[0]?.path;
        const sMedia = content?.media[mPath];

        getSpaceDetails(space.id, {
            withEvents: true,
            withMedia: !sMedia,
            withUser: shouldFetchUser,
            withRatings: true,
        }).then((data) => {
            if (data?.space?.notificationMsg) {
                navigation.setOptions({
                    title: (data.space.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' '),
                });
            }
            setFetchedSpace(data?.space || {});
        }).catch(() => {
            // Happens when space is not yet activated
        });

        MapsService.getSpaceMoments({
            itemsPerPage: 5,
            pageNumber: 1,
            withMedia: true,
        }, [space.id], true).then((response) => {
            setMoments(response.data?.results?.moments || []);
        }).catch((err) => {
            console.log(err);
        });

        setIsPairingsLoading(true);
        MapsService.getSpacePairings(space.id)
            .then((response) => {
                setSpacePairings(response?.data?.pairings || []);
                setIsPairingsLoading(false);
            })
            .catch(() => {
                setIsPairingsLoading(false);
            });

        navigation.setOptions({ title: notificationMsg });

        const unsubscribeNavListener = navigation.addListener('beforeRemove', (e) => {
            if (isViewingIncentives && (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP')) {
                e.preventDefault();
                setIsViewingIncentives(false);
            }
        });

        return () => {
            unsubscribeNavListener();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update nav listener when isViewingIncentives changes
    useEffect(() => {
        const unsubscribeNavListener = navigation.addListener('beforeRemove', (e) => {
            if (isViewingIncentives && (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP')) {
                e.preventDefault();
                setIsViewingIncentives(false);
            }
        });
        return () => {
            unsubscribeNavListener();
        };
    }, [navigation, isViewingIncentives]);

    const handleGoBack = useCallback(() => {
        if (isViewingIncentives) {
            setIsViewingIncentives(false);
            return;
        }
        if (!isUserAuthenticated(user)) {
            navigation.navigate('Map', { shouldShowPreview: true, previewScrollIndex });
        } else if (previousView === 'Areas') {
            navigation.goBack();
        } else if (previousView === 'ActivityGenerator') {
            navigation.navigate('ActivityGenerator');
        } else if (previousView === 'Notifications') {
            navigation.navigate('Notifications');
        } else {
            navigation.navigate('Map', { shouldShowPreview: true, previewScrollIndex });
        }
    }, [isViewingIncentives, user, previousView, previewScrollIndex, navigation]);

    const handleGoToViewMap = useCallback((lat, long) => {
        navigation.replace('Map', { latitude: lat, longitude: long });
    }, [navigation]);

    const handleGoToViewEvent = useCallback((evt) => {
        if (evt.id && isUserAuthenticated(user)) {
            navigation.navigate('ViewEvent', {
                isMyContent: evt?.fromUserId === user.details.id,
                previousView: 'Areas',
                event: { id: evt.id },
                eventDetails: {},
            });
        }
    }, [navigation, user]);

    const handleGoToViewMoment = useCallback((moment) => {
        if (moment.id && isUserAuthenticated(user)) {
            navigation.navigate('ViewMoment', {
                isMyContent: moment?.fromUserId === user.details.id,
                previousView: 'Areas',
                moment: { id: moment.id },
                momentDetails: {},
            });
        }
    }, [navigation, user]);

    const handleGoToViewUser = useCallback((userId) => {
        if (!isUserAuthenticated(user)) {
            navigation.navigate('ViewUser', { userInView: { id: userId } });
        }
    }, [navigation, user]);

    const handleGoToViewIncentives = useCallback(() => {
        if (isUserAuthenticated(user)) {
            setIsViewingIncentives(true);
            navigation.setOptions({
                animation: 'none',
            });
        } else {
            navigation.push('Login');
        }
    }, [user, navigation]);

    const handleUpdateSpaceReaction = useCallback((spaceId, data) => {
        if (isUserAuthenticated(user)) {
            navigation.setParams({
                space: {
                    ...space,
                    reaction: { ...space.reaction, ...data },
                },
            });
            // spaceInView spreads fetchedSpace last, so the fetched reaction
            // would otherwise clobber the optimistic update.
            setFetchedSpace((prev) => ({
                ...prev,
                reaction: { ...(prev?.reaction || {}), ...data },
            }));
            return createOrUpdateSpaceReaction(spaceId, data, space.fromUserId, user.details.userName);
        } else {
            navigation.push('Login');
            return Promise.resolve();
        }
    }, [user, space, navigation, createOrUpdateSpaceReaction]);

    const handleToggleAreaOptions = useCallback((displayArea?: any) => {
        const area = displayArea || { ...space, ...fetchedSpace };

        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'area',
                shouldIncludeShareButton: true,
                translate,
                themeForms,
                onSelect: (type: IContentSelectionType) => {
                    if (type === 'getDirections') {
                        getDirections({
                            latitude: area.latitude,
                            longitude: area.longitude,
                            title: area.notificationMsg,
                        });
                    } else if (type === 'shareALink') {
                        const shareUrl = buildSpaceUrl(user.settings?.locale || 'en-us', area.id);
                        Share.share({
                            message: translate('modals.contentOptions.shareLink.message', { spaceId: area.id, shareUrl }),
                            url: shareUrl,
                            title: translate('modals.contentOptions.shareLink.title', { spaceTitle: area.notificationMsg }),
                        }).catch((err) => console.error(err));
                    } else {
                        const requestArgs: any = getReactionUpdateArgs(type);
                        handleUpdateSpaceReaction(area.id, requestArgs);
                    }
                },
            },
        });
    }, [space, fetchedSpace, translate, themeForms, handleUpdateSpaceReaction, user.settings?.locale]);

    const handleEdit = useCallback(() => {
        navigation.navigate('EditSpace', {
            area: spaceInView,
            imageDetails: {},
            isBusinessAccount: checkIsMySpace(spaceInView, user) || user.details?.isBusinessAccount,
            isCreatorAccount: user.details?.isCreatorAccount,
        });
    }, [navigation, spaceInView, user]);

    const handleDeleteConfirm = useCallback(() => {
        setIsDeleting(true);
        if (checkIsMySpace(fetchedSpace, user)) {
            deleteSpace({ ids: [fetchedSpace.id] })
                .then(() => {
                    setIsDeleting(false);
                    setIsDeleteDialogVisible(false);
                    navigation.navigate('Map', { shouldShowPreview: false });
                })
                .catch((err) => {
                    console.log('Error deleting space', err);
                    setIsDeleting(false);
                    setIsDeleteDialogVisible(false);
                });
        } else {
            setIsDeleting(false);
            setIsDeleteDialogVisible(false);
        }
    }, [fetchedSpace, user, deleteSpace, navigation]);

    const handlePreviewFullScreen = useCallback((isFullScreen) => {
        setPreviewStyleState(isFullScreen ? {
            top: 0,
            left: 0,
            padding: 0,
            margin: 0,
            position: 'absolute',
            zIndex: 20,
        } : {});
    }, []);

    const handleCreateMoment = useCallback(() => {
        return requestLocationServiceActivation({
            isGpsEnabled: location?.settings?.isGpsEnabled,
            translate,
            shouldIgnoreRequirement: false,
        }).then((response: any) => {
            if (response?.status || Platform.OS === 'ios') {
                if (response?.alreadyEnabled && isLocationPermissionGranted(location.permissions)) {
                    if (!location?.settings?.isLocationDislosureComplete) {
                        return true;
                    } else {
                        return false;
                    }
                }
                updateLocationDisclosure(true);
                updateGpsStatus(response?.status || 'enabled');
                return false;
            }
            return Promise.resolve(false);
        }).then((shouldAbort) => {
            if (!shouldAbort && location.user?.latitude && location.user?.longitude) {
                const userCenter = {
                    latitude: location.user.latitude,
                    longitude: location.user.longitude,
                };
                const nearbySpaces = getNearbySpaces(userCenter, user, reactions, map?.spaces);
                if (nearbySpaces.length > 0) {
                    navigation.navigate({
                        name: 'EditMoment',
                        params: {
                            ...userCenter,
                            imageDetails: {},
                            nearbySpaces,
                            area: {},
                        },
                    });
                } else {
                    showToast.warn({
                        text1: translate('alertTitles.walkCloser'),
                        text2: translate('alertMessages.walkCloser'),
                    });
                    setIsUserInSpace(false);
                }
            }
        });
    }, [location, translate, updateLocationDisclosure, updateGpsStatus, user, reactions, map, navigation]);

    const handlePairingFeedback = useCallback((pairedSpaceId: string, isHelpful: boolean) => {
        setPairingFeedback((prev) => ({ ...prev, [pairedSpaceId]: isHelpful }));
        // Fire-and-forget
        MapsService.submitPairingFeedback(space.id, pairedSpaceId, isHelpful).catch(() => {});
    }, [space.id]);

    // An auto-applied correction writes the new value server-side while the
    // screen is still rendering the old one. The gateway invalidates the
    // space-details cache on apply, so a plain refetch returns the new value.
    const handleCorrectionApplied = useCallback(() => {
        getSpaceDetails(space.id, {
            withEvents: false,
            withMedia: false,
            withUser: false,
            withRatings: false,
        }).then((data) => {
            // Merged rather than replaced: this refetch asks only for the space
            // itself, so it must not drop what the initial fetch already resolved.
            setFetchedSpace((prev) => ({ ...prev, ...(data?.space || {}) }));
        }).catch(() => {
            // Non-fatal: the modal already confirmed the correction was applied
        });
    }, [getSpaceDetails, space.id]);

    const handleSuggestEdit = useCallback((fieldName?: CorrectionFieldName) => {
        setSuggestEditInitialField(fieldName);
        setIsSuggestEditModalVisible(true);
    }, []);

    const handleGoToViewSpace = useCallback((pairedSpace: any) => {
        navigation.push('ViewSpace', {
            space: pairedSpace,
            isMyContent: pairedSpace?.fromUserId === user.details.id,
            previousView: 'ViewSpace',
        });
    }, [navigation, user.details.id]);

    const formatCategoryLabel = useCallback((category: string): string => {
        if (!category) return '';
        const label = category.replace('categories.', '').replace('/', ' & ');
        return label.charAt(0).toUpperCase() + label.slice(1);
    }, []);

    const handleSharePairing = useCallback((pairing: any) => {
        const shareUrl = buildSpaceUrl(user.settings?.locale || 'en-us', pairing.id);
        Share.share({
            message: translate('modals.contentOptions.shareLink.message', { spaceId: pairing.id, shareUrl }),
            url: shareUrl,
            title: translate('modals.contentOptions.shareLink.title', { spaceTitle: pairing.notificationMsg }),
        }).catch((err) => console.error(err));
    }, [translate, user.settings?.locale]);

    const renderPairingCard = useCallback(({ item: pairing }: { item: any }) => {
        const pairingMediaPath = pairing.medias?.[0]?.path;
        const pairingMediaType = pairing.medias?.[0]?.type;
        const pairingMedia = pairingMediaPath && pairingMediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
            ? getUserContentUri(pairing.medias[0], pairingCardWidth, pairingCardWidth)
            : undefined;
        const hasFeedback = pairingFeedback[pairing.id] !== undefined;

        return (
            <AreaScrollerCard
                width={pairingCardWidth}
                seed={pairing.id}
                imageUri={pairingMedia}
                category={pairing.category}
                areaType="spaces"
                title={pairing.notificationMsg}
                badgeLabel={formatCategoryLabel(pairing.category) || undefined}
                metaLines={[pairing.addressReadable]}
                rating={pairing.rating?.avgRating}
                ratingCount={pairing.rating?.totalRatings}
                onPress={() => handleGoToViewSpace(pairing)}
                onSharePress={() => handleSharePairing(pairing)}
                shareAccessibilityLabel={translate('pages.viewSpace.actionLinks.share')}
                isDarkMode={isDarkMode}
                theme={theme}
                footerContent={(
                    <View style={localStyles.pairingFeedbackRow}>
                        {hasFeedback ? (
                            <Text style={[localStyles.pairingFeedbackText, { color: theme.colors.textGray }]}>
                                {pairingFeedback[pairing.id]
                                    ? translate('pages.viewSpace.pairings.helpful')
                                    : translate('pages.viewSpace.pairings.notHelpful')}
                            </Text>
                        ) : (
                            <>
                                <Pressable onPress={() => handlePairingFeedback(pairing.id, true)} hitSlop={8}>
                                    <Text style={[localStyles.pairingFeedbackLink, { color: brandColor }]}>
                                        {translate('pages.viewSpace.pairings.helpful')}
                                    </Text>
                                </Pressable>
                                <Text style={[localStyles.pairingFeedbackSeparator, { color: theme.colors.textGray }]}>|</Text>
                                <Pressable onPress={() => handlePairingFeedback(pairing.id, false)} hitSlop={8}>
                                    <Text style={[localStyles.pairingFeedbackLink, { color: brandColor }]}>
                                        {translate('pages.viewSpace.pairings.notHelpful')}
                                    </Text>
                                </Pressable>
                            </>
                        )}
                    </View>
                )}
            />
        );
    }, [
        pairingFeedback,
        handleGoToViewSpace,
        handlePairingFeedback,
        handleSharePairing,
        formatCategoryLabel,
        translate,
        isDarkMode,
        theme,
        brandColor,
    ]);

    const renderPairings = () => {
        // The wrapper carries the scroll view's bottom padding, so it must not
        // render at all when there is nothing to pad — most spaces have no
        // pairings and would otherwise end in 80px of dead space.
        if (!isPairingsLoading && !spacePairings.length) {
            return null;
        }

        return (
            <View style={localStyles.pairingsSection}>
                <HorizontalCardScroller
                    title={translate('pages.viewSpace.pairings.youMightAlsoLike')}
                    description={translate('pages.viewSpace.pairings.pairingsDescription', {
                        spaceName: spaceInView.notificationMsg || '',
                    })}
                    data={spacePairings}
                    isLoading={isPairingsLoading}
                    renderCard={renderPairingCard}
                    keyExtractor={(pairing: any, index: number) => String(pairing?.id ?? index)}
                    itemWidth={pairingCardWidth}
                    theme={theme}
                    testID="space-pairings-scroller"
                />
            </View>
        );
    };

    const renderViewIncentives = () => {
        const stepContainerStyle = [{ width: 50 }, spacingStyles.alignCenter];

        return (
            <View style={spacingStyles.fullWidth}>
                <View style={theme.styles.sectionContainer}>
                    <Text style={theme.styles.sectionTitleCenter}>
                        {translate('pages.viewSpace.h2.claimRewards')}
                    </Text>
                    {spaceInView.featuredIncentiveKey === IncentiveRequirementKeys.SHARE_A_MOMENT && (
                        <Text style={theme.styles.sectionDescription}>
                            {translate('pages.viewSpace.info.shareAMoment.claimRewards')}
                        </Text>
                    )}
                </View>
                <View style={themeArea.styles.banner}>
                    <View style={themeArea.styles.bannerTitle}>
                        <TherrIcon
                            name="gift"
                            size={20}
                            style={themeArea.styles.bannerTitleIcon}
                        />
                        <Text numberOfLines={1} style={[themeArea.styles.bannerTitleTextCenter, spacingStyles.flexOne]}>
                            {translate('pages.viewSpace.buttons.coinReward', {
                                count: spaceInView.featuredIncentiveRewardValue,
                            })}
                        </Text>
                    </View>
                </View>
                {spaceInView.featuredIncentiveKey === IncentiveRequirementKeys.SHARE_A_MOMENT && (
                    <View style={theme.styles.sectionContainer}>
                        <Text style={theme.styles.sectionTitleCenter}>
                            {translate('pages.viewSpace.h2.requirements')}
                        </Text>
                        <View style={spacingStyles.flexRow}>
                            <View style={stepContainerStyle}>
                                <MaterialIcon name="looks-one" size={23} style={{ color: theme.colors.primary4 }} />
                            </View>
                            <Text style={[theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                {translate('pages.viewSpace.info.shareAMoment.stepOne', { maxDistance: MAX_DISTANCE_TO_NEARBY_SPACE })}
                            </Text>
                        </View>
                        <View style={spacingStyles.flexRow}>
                            <View style={stepContainerStyle}>
                                <MaterialIcon name="looks-two" size={23} style={{ color: theme.colors.primary4 }} />
                            </View>
                            <Text style={[theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                {translate('pages.viewSpace.info.shareAMoment.stepTwo')}
                            </Text>
                        </View>
                        <View style={spacingStyles.flexRow}>
                            <View style={stepContainerStyle}>
                                <MaterialIcon name="looks-3" size={23} style={{ color: theme.colors.primary4 }} />
                            </View>
                            <Text style={[theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                {translate('pages.viewSpace.info.shareAMoment.stepThree')}
                            </Text>
                        </View>
                        <View style={spacingStyles.flexRow}>
                            <View style={stepContainerStyle}>
                                <MaterialIcon name="priority-high" size={23} style={{ color: theme.colors.primary4 }} />
                            </View>
                            <Text style={[theme.styles.sectionDescription16, spacingStyles.flexOne]}>
                                {translate('pages.viewSpace.info.shareAMoment.protip')}
                            </Text>
                        </View>
                    </View>
                )}
                <View style={theme.styles.sectionContainer}>
                    <PaperButton
                        mode="contained"
                        onPress={handleCreateMoment}
                        icon="map-clock"
                        buttonColor={theme.colors.brandingBlueGreen}
                        textColor={theme.colors.brandingWhite}
                        style={localStyles.incentiveButton}
                    >
                        {translate('menus.mapActions.uploadAMoment')}
                    </PaperButton>
                    {!isUserInSpace && (
                        <PaperText style={[theme.styles.sectionDescriptionNote, spacingStyles.marginTopSm]}>
                            {translate('pages.viewSpace.info.walkCloser')}
                        </PaperText>
                    )}
                </View>
            </View>
        );
    };

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={theme.styles.safeAreaView}>
                <KeyboardAwareScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={scrollViewRef}
                    style={[theme.styles.bodyFlex, themeAccentLayout.styles.bodyView]}
                    contentContainerStyle={[theme.styles.bodyScroll, themeAccentLayout.styles.bodyViewScroll]}
                >
                    <View style={[themeAccentLayout.styles.container, themeArea.styles.areaContainer]}>
                        {isViewingIncentives ? (
                            renderViewIncentives()
                        ) : (
                            <AreaDisplay
                                translate={translate}
                                toggleAreaOptions={handleToggleAreaOptions}
                                hashtags={hashtags}
                                isDarkMode={isDarkMode}
                                isExpanded={true}
                                inspectContent={() => null}
                                // Owners edit their own space directly from the footer —
                                // no reason to route them through crowdsourced agreement.
                                onSuggestEditPress={isMySpace ? undefined : handleSuggestEdit}
                                area={spaceInView}
                                goToViewEvent={handleGoToViewEvent}
                                goToViewMoment={handleGoToViewMoment}
                                goToViewMap={handleGoToViewMap}
                                goToViewUser={handleGoToViewUser}
                                goToViewIncentives={handleGoToViewIncentives}
                                updateAreaReaction={handleUpdateSpaceReaction}
                                user={user}
                                areaUserDetails={{
                                    media: spaceUserMedia,
                                    userName: areaUserName,
                                    isSuperUser: spaceUserIsSuperUser,
                                }}
                                areaMedia={spaceMedia}
                                placeholderMediaType="autoplay"
                                theme={theme}
                                themeForms={themeForms}
                                themeViewArea={themeArea}
                            />
                        )}
                    </View>
                    {previewLinkId && (
                        <View style={[userContentStyles.preview, previewStyleState]}>
                            <YoutubePlayer
                                height={260}
                                play={false}
                                videoId={previewLinkId}
                                onFullScreenChange={handlePreviewFullScreen}
                            />
                        </View>
                    )}
                    {!isViewingIncentives && renderPairings()}
                </KeyboardAwareScrollView>

                {/* Footer */}
                <View style={[themeAccentLayout.styles.footer, localStyles.footer]}>
                    <PaperButton
                        mode="outlined"
                        onPress={handleGoBack}
                        icon="arrow-left"
                        textColor={brandColor}
                        style={localStyles.footerButton}
                    >
                        {translate('forms.editSpace.buttons.back')}
                    </PaperButton>
                    {isMyContent && (
                        <>
                            <PaperButton
                                mode="outlined"
                                onPress={handleEdit}
                                icon="pencil"
                                textColor={brandColor}
                                style={localStyles.footerButton}
                            >
                                {translate('forms.editSpace.buttons.edit')}
                            </PaperButton>
                            <PaperButton
                                mode="contained"
                                onPress={() => setIsDeleteDialogVisible(true)}
                                icon="trash-can-outline"
                                buttonColor={theme.colors.accentRed}
                                textColor={theme.colors.brandingWhite}
                                style={localStyles.footerButton}
                                disabled={isDeleting}
                                loading={isDeleting}
                            >
                                {translate('forms.editSpace.buttons.delete')}
                            </PaperButton>
                        </>
                    )}
                </View>
            </SafeAreaView>

            {/* Delete confirmation modal */}
            <ConfirmModal
                isConfirming={isDeleting}
                isVisible={isDeleteDialogVisible}
                onCancel={() => setIsDeleteDialogVisible(false)}
                onConfirm={handleDeleteConfirm}
                text={translate('forms.editSpace.deleteConfirmation')}
                textConfirm={translate('forms.editSpace.buttons.confirm')}
                textCancel={translate('forms.editSpace.buttons.cancel')}
                translate={translate}
                theme={theme}
                themeModal={themeConfirmModal}
                themeButtons={themeButtons}
            />

            {/* Crowdsourced business info corrections */}
            <SuggestEditModal
                isVisible={isSuggestEditModalVisible}
                onRequestClose={() => setIsSuggestEditModalVisible(false)}
                spaceId={space.id}
                initialField={suggestEditInitialField}
                onApplied={handleCorrectionApplied}
                translate={translate}
                themeButtons={themeButtons}
                themeForms={themeForms}
            />
        </>
    );
};

export default connect(mapStateToProps, mapDispatchToProps)(ViewSpace);
