
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Linking,
    Pressable,
    Share,
    StyleSheet,
    Text,
    TouchableWithoutFeedbackComponent,
    View,
} from 'react-native';
import { Button } from '../BaseButton';
import { Image } from '../BaseImage';
import Icon from 'react-native-vector-icons/MaterialIcons';
// import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { showToast } from '../../utilities/toasts';
import { Categories, IncentiveRewardKeys } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import { MapsService } from 'therr-react/services';
import getConfig from '../../utilities/getConfig';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';
import { getUserContentUri, getUserImageUri } from '../../utilities/content';
import PresssableWithDoubleTap from '../../components/PressableWithDoubleTap';
import TherrIcon from '../TherrIcon';
// import { HAPTIC_FEEDBACK_TYPE } from '../../constants';
import formatDate from '../../utilities/formatDate';
import MissingImagePlaceholder from './MissingImagePlaceholder';
import SuperUserStatusIcon from '../SuperUserStatusIcon';
import SpaceRating from '../../components/Input/SpaceRating';
import { buildSpaceUrl } from '../../utilities/shareUrls';
import RichText from '../RichText';
import handleMentionPress from '../../utilities/handleMentionPress';
import { SheetManager } from 'react-native-actions-sheet';


const envConfig = getConfig();
const { width: viewportWidth } = Dimensions.get('window');

const formatCategoryLabel = (category: string): string => {
    if (!category) return '';
    const label = category.replace('categories.', '').replace('/', ' & ');
    return label.charAt(0).toUpperCase() + label.slice(1);
};

const formatPriceRange = (priceRange: number): string => '$'.repeat(priceRange);
// const hapticFeedbackOptions = {
//     enableVibrateFallback: false,
//     ignoreAndroidSystemSettings: false,
// };

interface IUserDetails {
    id?: string;
    userName: string;
    media: {
        profilePicture?: {
            path: string;
        };
    },
    isSuperUser?: boolean;
}

interface IAreaDisplayProps {
    translate: Function;
    toggleAreaOptions: any;
    toggleAttendingModal?: any;
    hashtags: any[];
    isDarkMode: boolean;
    isExpanded?: boolean;
    area: any;
    areaMedia: string;
    areaMediaPadding?: number;
    goToViewIncentives?: Function;
    goToViewUser: Function;
    goToViewMap: (lat: string, long: string) => any;
    goToViewEvent?: (area: any) => any;
    goToViewMoment?: (area: any) => any;
    goToViewSpace?: (area: any) => any;
    inspectContent: () => any;
    myReaction?: any;
    updateAreaReaction: Function;
    user: IUserState;
    areaUserDetails: IUserDetails;
    placeholderMediaType?: 'autoplay' | 'static' | undefined;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
    themeForms: {
        styles: any;
        colors: ITherrThemeColors;
    };
    themeViewArea: {
        styles: any;
        colors: ITherrThemeColors;
    };
}

interface IAreaDisplayState {
    isLiked: boolean;
    likeCount: number | null;
}

export default class AreaDisplay extends React.Component<IAreaDisplayProps, IAreaDisplayState> {
    static getDerivedStateFromProps(nextProps: IAreaDisplayProps, nextState: IAreaDisplayState) {
        if (nextProps.area?.likeCount != null
            && (nextState.likeCount == null)) {
            return {
                isLiked: !!nextProps.area.reaction?.userHasLiked,
                likeCount: nextProps.area?.likeCount,
            };
        }

        return null;
    }

    constructor(props: IAreaDisplayProps) {
        super(props);

        this.state = {
            isLiked: !!props.area.reaction?.userHasLiked,
            likeCount: props.area.likeCount,
        };
    }

    onAttendEventPress = () => {
        const { toggleAttendingModal } = this.props;
        toggleAttendingModal();
    };

    onAttendEventEditPress = () => {
        const { toggleAttendingModal } = this.props;
        toggleAttendingModal();
    };

    onClaimRewardPress = () => {
        const { goToViewIncentives, inspectContent } = this.props;
        if (goToViewIncentives) {
            goToViewIncentives();
        } else {
            inspectContent();
        }
    };

    onGoToSpace = () => {
        const { goToViewSpace } = this.props;
        if (goToViewSpace) {
            goToViewSpace(this.props.area);
        }
    };

    onViewMapPress = (area) => {
        const { goToViewMap } = this.props;

        goToViewMap(area.latitude, area.longitude);
    };

    // Lists support spaces only. Moments/events/thoughts don't set `category`
    // or `addressReadable`, so either field is a reliable space signal.
    isSpaceArea = (area) => area?.areaType === 'spaces'
        || !!area?.isSpace
        || typeof area?.category === 'string'
        || typeof area?.addressReadable === 'string';

    toggleBookmarkReaction = (area) => {
        const { updateAreaReaction, user } = this.props;

        updateAreaReaction(area.id, {
            userBookmarkCategory: area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, area.fromUserId, user?.details?.userName);
    };

    onBookmarkPress = (area) => {
        this.toggleBookmarkReaction(area);
    };

    onBookmarkLongPress = (area) => {
        // Spaces: long-press opens the list picker for curated Space Lists.
        // Non-spaces mirror tap (plain bookmark toggle).
        if (this.isSpaceArea(area)) {
            SheetManager.show('list-picker-sheet', {
                payload: {
                    spaceId: area.id,
                    translate: this.props.translate as any,
                    themeForms: this.props.themeForms,
                },
            });
            return;
        }
        this.toggleBookmarkReaction(area);
    };

    onLikePress = (area) => {
        if (!area.isDraft) {
            // ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);
            const { updateAreaReaction, user } = this.props;
            const newIsLiked = !this.state.isLiked;

            this.setState({
                isLiked: newIsLiked,
                likeCount: this.props.area.likeCount != null
                    ? (this.state.likeCount || 0) + (newIsLiked ? 1 : -1)
                    : this.state.likeCount,
            });

            updateAreaReaction(area.id, {
                userHasLiked: newIsLiked,
            }, area.fromUserId, user?.details?.userName);
        }
    };

    renderEventItem = (event) => {
        const { goToViewEvent, themeViewArea } = this.props;
        const onViewEvent = () => {
            if (goToViewEvent) {
                goToViewEvent(event);
            }
        };

        return (
            <View key={event.id} style={[
                { width: viewportWidth },
                spacingStyles.marginBotMd,
                spacingStyles.flex,
                spacingStyles.justifyCenter,
                spacingStyles.padHorizMd,
            ]}>
                <Text style={themeViewArea.styles.eventText}>
                    {/* eslint-disable-next-line max-len */}
                    {formatDate(event.scheduleStartAt, 'short').date} {formatDate(event.scheduleStartAt).time} - {formatDate(event.scheduleStopAt, 'short').date} {formatDate(event.scheduleStopAt).time}
                </Text>
                <Text onPress={onViewEvent} numberOfLines={2} style={[
                    themeViewArea.styles.eventText,
                    themeViewArea.styles.flexShrinkOne]}>
                    {event?.notificationMsg}
                </Text>
            </View>
        );
    };

    renderMomentItem = (moment) => {
        const { goToViewMoment, goToViewUser, theme, themeViewArea } = this.props;
        const onViewMoment = () => {
            if (goToViewMoment) {
                goToViewMoment(moment);
            }
        };

        return (
            <View style={[
                { width: viewportWidth },
                spacingStyles.marginBotMd,
                spacingStyles.flexRow,
                spacingStyles.justifyCenter,
                spacingStyles.padHorizMd,
            ]}>
                <Pressable
                    onPress={() => goToViewUser(moment.fromUserId)}
                >
                    <Image
                        source={{
                            uri: getUserImageUri({
                                details: {
                                    media: moment.fromUserMedia,
                                    id: moment.fromUserId,
                                },
                            }, 52),
                        }}
                        style={themeViewArea.styles.areaUserAvatarImg}
                        containerStyle={themeViewArea.styles.areaUserAvatarImgContainer}
                        height={themeViewArea.styles.areaUserAvatarImg.height}
                        width={themeViewArea.styles.areaUserAvatarImg.width}
                        PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.brandingBlueGreen} />}
                        transition={false}
                    />
                </Pressable>
                <View style={[
                    spacingStyles.flexOne,
                    spacingStyles.marginLtSm,
                ]}>
                    <Text onPress={() => goToViewUser(moment.fromUserId)}>
                        {moment.fromUserName}
                    </Text>
                    <Text onPress={onViewMoment} numberOfLines={2} style={[
                        themeViewArea.styles.eventText,
                        themeViewArea.styles.flexShrinkOne]}>
                        {moment?.notificationMsg}
                    </Text>
                </View>
                {
                    moment.medias?.length > 0 &&
                    <Image
                        onPress={onViewMoment}
                        source={{
                            uri: getUserContentUri(moment.medias[0], 100, 100),
                        }}
                        style={localStyles.momentThumbnail}
                        resizeMode="contain"
                        PlaceholderContent={<ActivityIndicator />}
                    />
                }
            </View>
        );
    };

    renderActionLink = ({ item }) => {
        const { area, themeForms, translate } = this.props;

        let onPress = () => Linking.openURL(item.url);

        if (item.icon === 'share') {
            const locale = this.props.user?.settings?.locale || 'en-us';
            const shareUrl = buildSpaceUrl(locale, area.id);
            onPress = () => Share.share({
                message: translate('modals.contentOptions.shareLink.message', {
                    spaceId: area.id,
                    shareUrl,
                }),
                url: shareUrl,
                title: translate('modals.contentOptions.shareLink.title', {
                    spaceTitle: area.notificationMsg,
                }),
            }).then((response) => {
                if (response.action === Share.sharedAction) {
                    if (response.activityType) {
                        // shared with activity type of response.activityType
                    } else {
                        // shared
                    }
                } else if (response.action === Share.dismissedAction) {
                    // dismissed
                }
            }).catch((err) => {
                console.error(err);
            });
        }

        return (
            <Button
                containerStyle={[spacingStyles.marginVertSm, spacingStyles.marginHorizSm]}
                buttonStyle={[themeForms.styles.buttonRoundAltSmall, spacingStyles.heightMd, spacingStyles.padHorizMd]}
                // disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                titleStyle={[themeForms.styles.buttonTitleAlt, localStyles.actionLinkTitle]}
                title={item.title}
                type="outline"
                onPress={onPress}
                raised={false}
                icon={
                    <TherrIcon
                        name={item.icon}
                        size={16}
                        style={[themeForms.styles.buttonIconAltSmall,spacingStyles.marginLtNone ]}
                    />
                }
            />
        );
    };

    claimSpace = () => {
        const { area, translate } = this.props;
        MapsService.claimSpace(area.id).then(() => {
            showToast.success({
                text1: translate('alertTitles.requestClaimSent'),
                text2: translate('alertMessages.requestClaimSent'),
            });
        });
    };

    render() {
        const {
            toggleAreaOptions,
            toggleAttendingModal,
            hashtags,
            isDarkMode,
            isExpanded,
            area,
            areaMedia,
            areaMediaPadding,
            goToViewUser,
            inspectContent,
            myReaction,
            areaUserDetails,
            placeholderMediaType,
            theme,
            themeForms,
            themeViewArea,
            translate,
            user,
        } = this.props;
        const { isLiked, likeCount } = this.state;

        const dateTime = formatDate(area.createdAt);
        const dateStr = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;
        const mediaPadding = areaMediaPadding || 0;
        const isBookmarked = area.reaction?.userBookmarkCategory;
        const likeColor = isLiked ? theme.colors.accentRed : (isDarkMode ? theme.colors.textWhite : theme.colors.tertiary);
        const shouldDisplayRewardsBanner = area.featuredIncentiveRewardValue
            && area.featuredIncentiveRewardKey
            && area.featuredIncentiveRewardKey === IncentiveRewardKeys.THERR_COIN_REWARD;
        const shouldDisplayRelatedSpaceBanner = isExpanded && area.spaceId;
        const isQuickReport = Categories.QuickReportCategories.includes(area.category);
        const toggleOptions = () => toggleAreaOptions(area);
        const isEvent = area.areaType === 'events';
        const isSpace = area.areaType === 'spaces';
        const isMoment = !isEvent && !isSpace;
        const mediaDimensions = {
            width: viewportWidth - (mediaPadding * 2),
            height: (isEvent || isSpace)
                ? ((viewportWidth - (mediaPadding * 2)) * (3 / 4))
                : viewportWidth - (mediaPadding * 2),
        };
        const actionLinks = !isSpace ? [] : [
            {
                url: area.websiteUrl,
                icon: 'globe',
                title: translate('pages.viewSpace.actionLinks.website'),
            },
            {
                url: area.menuUrl,
                icon: 'utensils',
                title: translate('pages.viewSpace.actionLinks.menu'),
            },
            {
                url: area.orderUrl,
                icon: 'shopping-bag',
                title: translate('pages.viewSpace.actionLinks.order'),
            },
            {
                url: area.reservationUrl,
                icon: 'calendar',
                title: translate('pages.viewSpace.actionLinks.reserve'),
            },
            {
                url: isSpace ? buildSpaceUrl(this.props.user?.settings?.locale || 'en-us', area.id) : undefined,
                icon: 'share',
                title: translate('pages.viewSpace.actionLinks.share'),
            },
        ]
            .filter(item => !!item?.url);

        if (isSpace && area.phoneNumber) {
            actionLinks.push({
                url:`tel:${area.phoneNumber}`,
                icon: 'phone',
                title: translate('pages.viewSpace.actionLinks.phone'),
            });
        }

        return (
            <View style={themeViewArea.styles.areaCard}>
                <View style={themeViewArea.styles.areaAuthorContainer}>
                    {
                        isSpace && !isExpanded
                            ? <View style={localStyles.spacerFlex} />
                            : <>
                                <Pressable
                                    onPress={() => goToViewUser(area.fromUserId)}
                                >
                                    <Image
                                        source={{
                                            uri: getUserImageUri({
                                                details: {
                                                    ...areaUserDetails,
                                                    media: area.fromUserMedia || areaUserDetails.media,
                                                    id: area.fromUserId || areaUserDetails.id,
                                                },
                                            }, 52),
                                        }}
                                        style={themeViewArea.styles.areaUserAvatarImg}
                                        containerStyle={themeViewArea.styles.areaUserAvatarImgContainer}
                                        height={themeViewArea.styles.areaUserAvatarImg.height}
                                        width={themeViewArea.styles.areaUserAvatarImg.width}
                                        PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.brandingBlueGreen} />}
                                        transition={false}
                                    />
                                </Pressable>
                                <View style={themeViewArea.styles.areaAuthorTextContainer}>
                                    {
                                        areaUserDetails &&
                                        <View style={[
                                            spacingStyles.flexRow,
                                            spacingStyles.alignCenter,
                                        ]}>
                                            <Text style={themeViewArea.styles.areaUserName} numberOfLines={1}>
                                                {`${areaUserDetails.userName}`}
                                            </Text>
                                            <SuperUserStatusIcon
                                                isSuperUser={areaUserDetails.isSuperUser}
                                                size={14}
                                                isDarkMode={isDarkMode}
                                                style={[
                                                    {
                                                        marginBottom: themeViewArea.styles.areaUserName.marginBottom,
                                                    },
                                                    spacingStyles.padLtTiny,
                                                ]}
                                            />
                                        </View>
                                    }
                                    <Text style={themeViewArea.styles.dateTime}>
                                        {dateStr}
                                    </Text>
                                </View>
                            </>
                    }
                    <Button
                        containerStyle={themeViewArea.styles.moreButtonContainer}
                        buttonStyle={themeViewArea.styles.moreButton}
                        icon={
                            <Icon
                                name="more-horiz"
                                size={24}
                                color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                            />
                        }
                        onPress={toggleOptions}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                {
                    isExpanded && actionLinks.length > 0
                    && <FlatList
                        horizontal
                        data={actionLinks}
                        renderItem={this.renderActionLink}
                        keyExtractor={item => item.url}
                        style={localStyles.fullWidth}
                        showsHorizontalScrollIndicator={false}
                    />
                }
                <View>
                    <PresssableWithDoubleTap
                        style={{}}
                        onPress={inspectContent}
                        onDoubleTap={() => this.onLikePress(area)}
                    >
                        {/* <UserMedia
                            viewportWidth={viewportWidth}
                            media={areaMedia}
                            isVisible={!!areaMedia}
                            isSingleView={isExpanded}
                        /> */}
                        {
                            areaMedia ?
                                <Image
                                    source={{
                                        uri: areaMedia,
                                    }}
                                    style={{
                                        width: mediaDimensions.width,
                                        height: mediaDimensions.height,
                                    }}
                                    resizeMode="contain"
                                    PlaceholderContent={<ActivityIndicator />}
                                /> :
                                placeholderMediaType && <MissingImagePlaceholder
                                    area={area}
                                    themeViewArea={themeViewArea}
                                    placeholderMediaType={placeholderMediaType}
                                    dimensions={{
                                        height: Math.min(mediaDimensions.height, 160),
                                        width: mediaDimensions.width,
                                    }}
                                />
                        }
                    </PresssableWithDoubleTap>
                </View>
                <View style={themeViewArea.styles.areaContentTitleContainer}>
                    <View style={localStyles.titleWithBadge}>
                        <Text
                            style={[themeViewArea.styles.areaContentTitle, localStyles.titleText]}
                            numberOfLines={2}
                        >
                            {sanitizeNotificationMsg(area.notificationMsg)}
                        </Text>
                        {isQuickReport && (
                            <View style={[localStyles.quickReportBadge, { backgroundColor: theme.colors.brandingOrange }]}>
                                <Icon name="schedule" size={12} color={theme.colors.brandingWhite} />
                                <Text style={localStyles.quickReportBadgeText}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    {
                        <Button
                            containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                            buttonStyle={themeViewArea.styles.areaReactionButton}
                            icon={
                                <Icon
                                    name="place"
                                    size={24}
                                    color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                />
                            }
                            onPress={() => this.onViewMapPress(area)}
                            type="clear"
                            TouchableComponent={TouchableWithoutFeedbackComponent}
                        />
                    }
                    {
                        !area.isDraft && !isMoment &&
                        <>
                            {
                                area?.viewCount != null &&
                                <Button
                                    containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                                    buttonStyle={themeViewArea.styles.areaReactionButton}
                                    icon={
                                        <TherrIcon
                                            name="bar-chart"
                                            size={22}
                                            color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                        />
                                    }
                                    onPress={() => {}}
                                    type="clear"
                                    title={area?.viewCount}
                                    titleStyle={[
                                        themeViewArea.styles.areaReactionButtonTitle,
                                        { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                    ]}
                                    TouchableComponent={TouchableWithoutFeedbackComponent}
                                />
                            }
                            <Button
                                containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                                buttonStyle={themeViewArea.styles.areaReactionButton}
                                icon={
                                    <Icon
                                        name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                                        size={24}
                                        color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                    />
                                }
                                onPress={() => this.onBookmarkPress(area)}
                                onLongPress={() => this.onBookmarkLongPress(area)}
                                type="clear"
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                            <Button
                                containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                                buttonStyle={themeViewArea.styles.areaReactionButton}
                                icon={
                                    <TherrIcon
                                        name={isLiked ? 'heart-filled' : 'heart'}
                                        size={22}
                                        color={likeColor}
                                    />
                                }
                                onPress={() => this.onLikePress(area)}
                                type="clear"
                                title={(likeCount && likeCount > 0) ? likeCount.toString() : ''}
                                titleStyle={[
                                    themeViewArea.styles.areaReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        </>
                    }
                </View>
                {
                    isEvent &&
                    <View style={themeViewArea.styles.banner}>
                        <View style={themeViewArea.styles.bannerTitle}>
                            <TherrIcon
                                name="calendar"
                                size={20}
                                style={themeViewArea.styles.bannerTitleIcon}
                            />
                            <Text numberOfLines={1} style={themeViewArea.styles.bannerTitleText}>
                                {/* eslint-disable-next-line max-len */}
                                {formatDate(area.scheduleStartAt, 'short').date} {formatDate(area.scheduleStartAt).time} - {formatDate(area.scheduleStopAt, 'short').date} {formatDate(area.scheduleStopAt).time}
                            </Text>
                        </View>
                    </View>
                }
                {
                    shouldDisplayRewardsBanner &&
                    <Pressable style={themeViewArea.styles.banner} onPress={this.onClaimRewardPress}>
                        <View style={themeViewArea.styles.bannerTitle}>
                            <TherrIcon
                                name="gift"
                                size={20}
                                style={themeViewArea.styles.bannerTitleIcon}
                            />
                            <Text numberOfLines={1} style={themeViewArea.styles.bannerTitleText}>
                                {translate('pages.viewSpace.buttons.coinReward', {
                                    count: area.featuredIncentiveRewardValue,
                                })}
                            </Text>
                        </View>
                        <Pressable onPress={this.onClaimRewardPress} style={spacingStyles.marginRtMd}>
                            <Text style={themeViewArea.styles.bannerLinkText}>
                                {translate('pages.viewSpace.buttons.claimRewards')}
                            </Text>
                        </Pressable>
                    </Pressable>
                }
                {
                    shouldDisplayRelatedSpaceBanner &&
                    <Pressable style={themeViewArea.styles.banner} onPress={this.onGoToSpace}>
                        <View style={themeViewArea.styles.bannerTitle}>
                            <TherrIcon
                                name="road-map"
                                size={20}
                                style={themeViewArea.styles.bannerTitleIcon}
                            />
                            {
                                area.space &&
                                <Text numberOfLines={1} style={themeViewArea.styles.bannerTitleText}>
                                    {area.space?.notificationMsg}
                                </Text>
                            }
                        </View>
                        <Pressable onPress={this.onGoToSpace} style={spacingStyles.marginRtMd}>
                            <Text style={themeViewArea.styles.bannerLinkText}>
                                {translate('pages.viewMoment.buttons.viewNearbySpace')}
                            </Text>
                        </Pressable>
                    </Pressable>
                }
                {
                    isSpace && isExpanded && (area.category || area.priceRange > 0) &&
                    <View style={[spacingStyles.flexRow, spacingStyles.alignCenter, spacingStyles.padHorizMd, spacingStyles.padVertSm, localStyles.metaRow]}>
                        {area.category ? (
                            <View style={[localStyles.categoryBadge, { backgroundColor: theme.colors.primary3 }]}>
                                <Text style={[localStyles.categoryBadgeText, {
                                    color: isDarkMode ? theme.colors.textWhite : theme.colors.primary4,
                                }]}>
                                    {formatCategoryLabel(area.category)}
                                </Text>
                            </View>
                        ) : null}
                        {area.priceRange > 0 ? (
                            <Text style={[localStyles.priceRangeText, { color: theme.colors.textGray }]}>
                                {formatPriceRange(area.priceRange)}
                            </Text>
                        ) : null}
                    </View>
                }
                {
                    isSpace && isExpanded && area.addressReadable &&
                    <View style={[spacingStyles.padHorizMd, localStyles.addressSection]}>
                        <View style={[spacingStyles.flexRow, spacingStyles.alignCenter]}>
                            <Icon name="place" size={16} color={theme.colors.textGray} />
                            <Text style={[localStyles.addressText, { color: isDarkMode ? theme.colors.textWhite : theme.colors.textDark }]}>
                                {area.addressReadable}
                            </Text>
                        </View>
                    </View>
                }
                <View style={[
                    spacingStyles.flexRow,
                ]}>
                    <View style={[
                        spacingStyles.flexOne,
                        spacingStyles.padLtSm,
                        spacingStyles.padBotMd,
                    ]}>
                        {
                            area.rating?.avgRating &&
                            <View style={[
                                spacingStyles.alignCenter,
                                spacingStyles.flexRow,
                            ]}>
                                <Text style={[spacingStyles.padRtTiny, localStyles.ratingText,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary }]}>
                                    {area.rating?.avgRating}
                                </Text>
                                <SpaceRating
                                    themeForms={themeForms}
                                    initialRating={area.rating?.avgRating}
                                    starSize={20}
                                    style={[
                                        spacingStyles.alignCenter,
                                        spacingStyles.justifyStart,
                                        localStyles.ratingStars,
                                    ]}
                                />
                                <Text style={[spacingStyles.padLtTiny, localStyles.ratingText,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary }]}>
                                    ({area.rating.totalRatings})
                                </Text>
                            </View>
                        }
                    </View>
                    {
                        area.distance != null &&
                        <Text style={[themeViewArea.styles.areaDistanceRight, localStyles.distanceText]}>
                            {`${area.distance}`}
                        </Text>
                    }
                </View>
                <RichText
                    style={themeViewArea.styles.areaMessage}
                    text={area.message}
                    linkStyle={theme.styles.link}
                    onMentionPress={!isSpace ? (username) => handleMentionPress(username, goToViewUser) : undefined}
                    numberOfLines={isExpanded ? undefined : 3}
                />
                {
                    isExpanded && isEvent &&
                    <View style={[
                        spacingStyles.flexOne,
                        spacingStyles.fullWidth,
                        spacingStyles.padHorizLg,
                        spacingStyles.padVertMd,
                        spacingStyles.marginTopMd,
                    ]}>
                        {
                            myReaction?.attendingCount < 1 &&
                            <Button
                                buttonStyle={[
                                    themeForms.styles.buttonPrimarySmall,
                                    {
                                        backgroundColor: themeForms.colors.primary4,
                                    },
                                ]}
                                titleStyle={themeForms.styles.buttonTitle}
                                title={translate('pages.viewSpace.buttons.attendThisEvent')}
                                // type="outline"
                                // icon={
                                //     <FontAwesome5Icon
                                //         name="sync"
                                //         size={22}
                                //         style={themeForms.styles.buttonIconAlt}
                                //     />
                                // }
                                raised={false}
                                onPress={toggleAttendingModal}
                            />
                        }
                        {
                            myReaction?.attendingCount > 0 &&
                            <>
                                <Button
                                    buttonStyle={[
                                        themeForms.styles.buttonPrimarySmall,
                                        {
                                            backgroundColor: themeForms.colors.primary4,
                                        },
                                    ]}
                                    titleStyle={themeForms.styles.buttonTitle}
                                    title={
                                        `${translate('pages.viewSpace.buttons.attendingConfirmed')} (${myReaction?.attendingCount})`
                                    }
                                    // type="outline"
                                    // icon={
                                    //     <FontAwesome5Icon
                                    //         name="sync"
                                    //         size={22}
                                    //         style={themeForms.styles.buttonIconAlt}
                                    //     />
                                    // }
                                    disabled={true}
                                    raised={false}
                                    onPress={toggleAttendingModal}
                                />
                                <Button
                                    titleStyle={themeForms.styles.buttonTitleLink}
                                    title={translate('pages.viewSpace.buttons.editRSVP')}
                                    type="clear"
                                    // icon={
                                    //     <FontAwesome5Icon
                                    //         name="sync"
                                    //         size={22}
                                    //         style={themeForms.styles.buttonIconAlt}
                                    //     />
                                    // }
                                    raised={false}
                                    onPress={this.onAttendEventEditPress}
                                />
                            </>
                        }
                    </View>
                }
                <View>
                    <HashtagsContainer
                        hasIcon={false}
                        hashtags={hashtags}
                        onHashtagPress={() => { }}
                        visibleCount={isExpanded ? 20 : 5}
                        right
                        styles={themeForms.styles}
                    />
                </View>
                {
                    isMoment && !area.isDraft &&
                    <View style={themeViewArea.styles.areaReactionsContainer}>
                        {
                            area?.viewCount != null &&
                            <Button
                                containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                                buttonStyle={themeViewArea.styles.areaReactionButton}
                                icon={
                                    <TherrIcon
                                        name="bar-chart"
                                        size={22}
                                        color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                    />
                                }
                                onPress={() => {}}
                                type="clear"
                                title={area?.viewCount}
                                titleStyle={[
                                    themeViewArea.styles.areaReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        }
                        <Button
                            containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                            buttonStyle={themeViewArea.styles.areaReactionButton}
                            icon={
                                <Icon
                                    name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                                    size={24}
                                    color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                />
                            }
                            onPress={() => this.onBookmarkPress(area)}
                            onLongPress={() => this.onBookmarkLongPress(area)}
                            type="clear"
                            TouchableComponent={TouchableWithoutFeedbackComponent}
                        />
                        <Button
                            containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                            buttonStyle={themeViewArea.styles.areaReactionButton}
                            icon={
                                <TherrIcon
                                    name={isLiked ? 'heart-filled' : 'heart'}
                                    size={22}
                                    color={likeColor}
                                />
                            }
                            onPress={() => this.onLikePress(area)}
                            type="clear"
                            title={(likeCount && likeCount > 0) ? likeCount.toString() : ''}
                            titleStyle={[
                                themeViewArea.styles.areaReactionButtonTitle,
                                { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                            ]}
                            TouchableComponent={TouchableWithoutFeedbackComponent}
                        />
                    </View>
                }
                {
                    isSpace && isExpanded && area.openingHours?.schema?.length > 0
                    && <View style={[spacingStyles.padHorizMd, spacingStyles.padVertMd]}>
                        <Text style={theme.styles.sectionTitleCenter}>
                            {translate('pages.viewSpace.h2.hours')}
                        </Text>
                        <View style={localStyles.hoursGrid}>
                            {area.openingHours.schema.map((entry: string) => {
                                const parts = entry.split(' ');
                                const days = parts[0] || '';
                                const hours = parts.slice(1).join(' ') || '';
                                return (
                                    <View key={entry} style={localStyles.hoursRow}>
                                        <Text style={[localStyles.hoursDayText, {
                                            color: isDarkMode ? theme.colors.textWhite : theme.colors.textDark,
                                        }]}>
                                            {days}
                                        </Text>
                                        <Text style={[localStyles.hoursTimeText, { color: theme.colors.textGray }]}>
                                            {hours}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                }
                {
                    isSpace && isExpanded && (area.addressStreetAddress || area.addressLocality || area.addressRegion || area.phoneNumber)
                    && <View style={[spacingStyles.padHorizMd, spacingStyles.padVertSm]}>
                        <Text style={theme.styles.sectionTitleCenter}>
                            {translate('pages.viewSpace.h2.contactAndLocation')}
                        </Text>
                        {area.addressStreetAddress ? (
                            <Text style={[localStyles.contactText, {
                                color: isDarkMode ? theme.colors.textWhite : theme.colors.textDark,
                            }]}>
                                {area.addressStreetAddress}
                            </Text>
                        ) : null}
                        {(area.addressLocality || area.addressRegion) ? (
                            <Text style={[localStyles.contactText, {
                                color: isDarkMode ? theme.colors.textWhite : theme.colors.textDark,
                            }]}>
                                {[area.addressLocality, area.addressRegion].filter(Boolean).join(', ')}
                                {area.postalCode ? ` ${area.postalCode}` : ''}
                            </Text>
                        ) : null}
                        {area.phoneNumber ? (
                            <Pressable onPress={() => Linking.openURL(`tel:${area.phoneNumber}`)}>
                                <Text style={[localStyles.contactLinkText, {
                                    color: isDarkMode ? theme.colors.textWhite : theme.colors.brandingBlueGreen,
                                }]}>
                                    {area.phoneNumber}
                                </Text>
                            </Pressable>
                        ) : null}
                        {area.latitude && area.longitude ? (
                            <Pressable onPress={() => Linking.openURL(
                                `https://www.google.com/maps/search/?api=1&query=${area.latitude},${area.longitude}`
                            )}>
                                <Text style={[localStyles.contactLinkText, {
                                    color: isDarkMode ? theme.colors.textWhite : theme.colors.brandingBlueGreen,
                                }]}>
                                    {translate('pages.viewSpace.labels.viewOnGoogleMaps')}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                }
                {
                    isSpace && isExpanded && area.events?.length > 0
                    && <View style={[spacingStyles.padHorizMd, spacingStyles.padVertMd]}>
                        <Text style={theme.styles.sectionTitleCenter}>
                            {translate('pages.viewSpace.h2.events')}
                        </Text>
                        <View style={[spacingStyles.fullWidth]}>
                            {
                                area.events?.map((event) => this.renderEventItem(event))
                            }
                        </View>
                    </View>
                }
                {
                    isSpace && isExpanded && area.associatedMoments?.length > 0
                    && <View style={[spacingStyles.padHorizMd, spacingStyles.padVertMd]}>
                        <Text style={theme.styles.sectionTitleCenter}>
                            {translate('pages.viewSpace.h2.moments')}
                        </Text>
                        <View style={[spacingStyles.fullWidth]}>
                            {
                                area.associatedMoments?.map((moment) => this.renderMomentItem(moment))
                            }
                        </View>
                    </View>
                }
                {
                    isSpace
                    && area.fromUserId === envConfig.superAdminId
                    && area.fromUserId !== user?.details?.id
                    && area.requestedByUserId !== user?.details?.id
                    && user?.details?.isBusinessAccount &&
                    <View>
                        <Button
                            titleStyle={themeForms.styles.buttonLink}
                            title={translate('pages.viewSpace.buttons.claimThisBusiness')}
                            type="clear"
                            // icon={
                            //     <FontAwesome5Icon
                            //         name="sync"
                            //         size={22}
                            //         style={themeForms.styles.buttonIconAlt}
                            //     />
                            // }
                            raised={false}
                            onPress={this.claimSpace}
                        />
                    </View>
                }
            </View>
        );
    }
}

const localStyles = StyleSheet.create({
    momentThumbnail: {
        width: 100,
        height: 100,
        borderRadius: 5,
    },
    actionLinkTitle: {
        fontSize: 12,
    },
    spacerFlex: {
        flex: 1,
    },
    fullWidth: {
        width: '100%',
    },
    ratingText: {
        fontWeight: '300',
    },
    ratingStars: {
        width: 'auto',
    },
    distanceText: {
        width: 'auto',
    },
    metaRow: {
        flexWrap: 'wrap',
        gap: 8,
    },
    categoryBadge: {
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    categoryBadgeText: {
        fontSize: 13,
        fontWeight: '500',
    },
    priceRangeText: {
        fontSize: 15,
        fontWeight: '600',
    },
    addressSection: {
        paddingBottom: 4,
    },
    addressText: {
        fontSize: 13,
        marginLeft: 4,
        flexShrink: 1,
    },
    hoursGrid: {
        marginTop: 8,
    },
    hoursRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    hoursDayText: {
        fontSize: 14,
        fontWeight: '600',
        minWidth: 80,
    },
    hoursTimeText: {
        fontSize: 14,
        flex: 1,
        textAlign: 'right',
    },
    contactText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 4,
    },
    contactLinkText: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    titleWithBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: 8,
    },
    titleText: {
        flexShrink: 1,
    },
    quickReportBadge: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        gap: 4,
    },
    quickReportBadgeText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
