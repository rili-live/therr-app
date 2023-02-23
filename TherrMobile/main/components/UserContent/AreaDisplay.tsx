
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    Text,
    TouchableWithoutFeedbackComponent,
    View,
} from 'react-native';
import { Button, Image } from 'react-native-elements';
import Autolink from 'react-native-autolink';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { IncentiveRewardKeys } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import UserMedia from './UserMedia';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';
import { getUserImageUri } from '../../utilities/content';
import PresssableWithDoubleTap from '../../components/PressableWithDoubleTap';
import TherrIcon from '../TherrIcon';

const { width: viewportWidth } = Dimensions.get('window');

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

interface IUserDetails {
    userName: string;
}

interface IAreaDisplayProps {
    translate: Function;
    date: string;
    toggleAreaOptions: any;
    hashtags: any[];
    isDarkMode: boolean;
    isExpanded?: boolean;
    area: any;
    areaMedia: string;
    goToViewIncentives: Function;
    goToViewUser: Function;
    goToViewMap: (lat: string, long: string) => any;
    goToViewSpace?: (area: any) => any;
    inspectContent: () => any;
    updateAreaReaction: Function;
    user: IUserState;
    areaUserDetails: IUserDetails;
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
    likeCount: number | null;
}

export default class AreaDisplay extends React.Component<IAreaDisplayProps, IAreaDisplayState> {
    static getDerivedStateFromProps(nextProps: IAreaDisplayProps, nextState: IAreaDisplayState) {
        if (nextProps.area?.likeCount != null
            && nextState.likeCount == null) {
            return {
                likeCount: nextProps.area?.likeCount,
            };
        }

        return null;
    }

    constructor(props: IAreaDisplayProps) {
        super(props);

        this.state = {
            likeCount: props.area.likeCount,
        };
    }

    onClaimRewardPress = () => {
        const { goToViewIncentives } = this.props;
        goToViewIncentives();
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

    onBookmarkPress = (area) => {
        const { updateAreaReaction, user } = this.props;

        updateAreaReaction(area.id, {
            userBookmarkCategory: area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, area.fromUserId, user?.details?.userName);
    };

    onLikePress = (area) => {
        if (!area.isDraft) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);
            const { updateAreaReaction, user } = this.props;

            // Only display on own user post
            if (this.props.area.likeCount != null) {
                this.setState({
                    likeCount: !area.reaction?.userHasLiked
                        ? (this.state.likeCount || 0) + 1
                        : (this.state.likeCount || 0) - 1,
                });
            }

            updateAreaReaction(area.id, {
                userHasLiked: !area.reaction?.userHasLiked,
            }, area.fromUserId, user?.details?.userName);
        }
    };

    render() {
        const {
            date,
            toggleAreaOptions,
            hashtags,
            isDarkMode,
            isExpanded,
            area,
            areaMedia,
            goToViewUser,
            inspectContent,
            areaUserDetails,
            theme,
            themeForms,
            themeViewArea,
            translate,
        } = this.props;
        const { likeCount } = this.state;

        const isBookmarked = area.reaction?.userBookmarkCategory;
        const isLiked = area.reaction?.userHasLiked;
        const likeColor = isLiked ? theme.colors.accentRed : (isDarkMode ? theme.colors.textWhite : theme.colors.tertiary);
        const shouldDisplayRewardsBanner = isExpanded
            && area.featuredIncentiveRewardValue
            && area.featuredIncentiveRewardKey
            && area.featuredIncentiveRewardKey === IncentiveRewardKeys.THERR_COIN_REWARD;
        const shouldDisplayRelatedSpaceBanner = isExpanded && area.spaceId;

        return (
            <>
                <View style={themeViewArea.styles.areaAuthorContainer}>
                    <Pressable
                        onPress={() => goToViewUser(area.fromUserId)}
                    >
                        <Image
                            source={{ uri: getUserImageUri({ details: { media: area.fromUserMedia, id: area.fromUserId } }, 52) }}
                            style={themeViewArea.styles.areaUserAvatarImg}
                            containerStyle={themeViewArea.styles.areaUserAvatarImgContainer}
                            height={themeViewArea.styles.areaUserAvatarImg.height}
                            width={themeViewArea.styles.areaUserAvatarImg.width}
                            PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.primary}/>}
                            transition={false}
                        />
                    </Pressable>
                    <View style={themeViewArea.styles.areaAuthorTextContainer}>
                        {
                            areaUserDetails &&
                                <Text style={themeViewArea.styles.areaUserName} numberOfLines={1}>
                                    {`${areaUserDetails.userName}`}
                                </Text>
                        }
                        <Text style={themeViewArea.styles.dateTime}>
                            {date}
                        </Text>
                    </View>
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
                        onPress={toggleAreaOptions}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <PresssableWithDoubleTap
                    style={{}}
                    onPress={inspectContent}
                    onDoubleTap={() => this.onLikePress(area)}
                >
                    <UserMedia
                        viewportWidth={viewportWidth}
                        media={areaMedia}
                        isVisible={!!areaMedia}
                        isSingleView={isExpanded}
                    />
                </PresssableWithDoubleTap>
                <View style={themeViewArea.styles.areaContentTitleContainer}>
                    <Text
                        style={themeViewArea.styles.areaContentTitle}
                        numberOfLines={2}
                    >
                        {sanitizeNotificationMsg(area.notificationMsg)}
                    </Text>
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
                        !area.isDraft &&
                        <>
                            <Button
                                containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                                buttonStyle={themeViewArea.styles.areaReactionButton}
                                icon={
                                    <Icon
                                        name={ isBookmarked ? 'bookmark' : 'bookmark-border' }
                                        size={24}
                                        color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                    />
                                }
                                onPress={() => this.onBookmarkPress(area)}
                                type="clear"
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                            <Button
                                containerStyle={themeViewArea.styles.areaReactionButtonContainer}
                                buttonStyle={themeViewArea.styles.areaReactionButton}
                                icon={
                                    <TherrIcon
                                        name={ isLiked ? 'heart-filled' : 'heart' }
                                        size={22}
                                        color={likeColor}
                                    />
                                }
                                onPress={() => this.onLikePress(area)}
                                type="clear"
                                title={(isExpanded && likeCount && likeCount > 0) ? likeCount.toString() : ''}
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
                    shouldDisplayRewardsBanner &&
                    <Pressable style={themeViewArea.styles.banner} onPress={this.onClaimRewardPress}>
                        <View style={themeViewArea.styles.bannerTitle}>
                            <Button
                                type="clear"
                                icon={
                                    <TherrIcon
                                        name="gift"
                                        size={28}
                                        style={themeViewArea.styles.bannerTitleIcon}
                                    />
                                }
                                onPress={this.onClaimRewardPress}
                            />
                            <Text numberOfLines={1} style={themeViewArea.styles.bannerTitleText}>
                                {translate('pages.viewSpace.buttons.coinReward', {
                                    count: area.featuredIncentiveRewardValue,
                                })}
                            </Text>
                        </View>
                        <Pressable onPress={this.onClaimRewardPress}>
                            <Text style={themeViewArea.styles.bannerLinkText}>
                                {translate('pages.viewSpace.buttons.claimRewards')}
                            </Text>
                        </Pressable>
                        <Button
                            icon={
                                <TherrIcon
                                    name="hand-coin"
                                    size={28}
                                    color={theme.colors.accentYellow}
                                />
                            }
                            iconRight
                            onPress={this.onClaimRewardPress}
                            type="clear"
                        />
                    </Pressable>
                }
                {
                    shouldDisplayRelatedSpaceBanner &&
                    <Pressable style={themeViewArea.styles.banner} onPress={this.onGoToSpace}>
                        <View style={themeViewArea.styles.bannerTitle}>
                            <Button
                                type="clear"
                                icon={
                                    <TherrIcon
                                        name="road-map"
                                        size={28}
                                        style={themeViewArea.styles.bannerTitleIcon}
                                    />
                                }
                                onPress={this.onGoToSpace}
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
                <Text style={themeViewArea.styles.areaMessage} numberOfLines={isExpanded ? undefined : 3}>
                    <Autolink
                        text={area.message}
                        linkStyle={theme.styles.link}
                        phone="sms"
                    />
                </Text>
                <View>
                    <HashtagsContainer
                        hasIcon={false}
                        hashtags={hashtags}
                        onHashtagPress={() => {}}
                        visibleCount={isExpanded ? 20 : 5}
                        right
                        styles={themeForms.styles}
                    />
                </View>
                {
                    area.distance != null &&
                    <Text  style={themeViewArea.styles.areaDistance}>{`${area.distance} mi`}</Text>
                }
            </>
        );
    }
}
