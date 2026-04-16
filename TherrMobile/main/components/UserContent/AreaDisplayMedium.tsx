
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    StyleSheet,
    Text,
    TouchableWithoutFeedbackComponent,
    View,
} from 'react-native';
import { Button } from '../BaseButton';
import { Image } from '../BaseImage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Categories } from 'therr-js-utilities/constants';
import { IUserState } from 'therr-react/types';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';
import { getUserImageUri } from '../../utilities/content';
import PresssableWithDoubleTap from '../PressableWithDoubleTap';
import formatDate from '../../utilities/formatDate';
import MissingImagePlaceholder from './MissingImagePlaceholder';
import RichText from '../RichText';
import handleMentionPress from '../../utilities/handleMentionPress';

const { width: viewportWidth } = Dimensions.get('window');

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
}

interface IAreaDisplayContentProps {
    translate: Function;
    hashtags: any[];
    isDarkMode: boolean;
    area: any;
    areaMedia: string;
    goToViewUser?: Function;
    inspectContent: () => any;
    onBookmarkPress?: () => any;
    onDoubleTap?: () => any;
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

interface IAreaDisplayMediumProps extends IAreaDisplayContentProps {
    areaUserDetails: IUserDetails;
    goToViewMap: (lat: string, long: string) => any;
    goToViewUser: Function;
    toggleAreaOptions: Function;
    updateAreaReaction: Function;
    user: IUserState;
}

interface IAreaDisplayMediumState {
    isLiked: boolean;
    likeCount: number | null;
    mediaWidth: number;
}

export default class AreaDisplayMedium extends React.Component<IAreaDisplayMediumProps, IAreaDisplayMediumState> {
    static getDerivedStateFromProps(nextProps: IAreaDisplayMediumProps, nextState: IAreaDisplayMediumState) {
        if (nextProps.area?.likeCount != null
            && (nextState.likeCount == null)) {
            return {
                isLiked: !!nextProps.area.reaction?.userHasLiked,
                likeCount: nextProps.area?.likeCount,
            };
        }

        return null;
    }

    constructor(props: IAreaDisplayMediumProps) {
        super(props);

        this.state = {
            isLiked: !!props.area.reaction?.userHasLiked,
            likeCount: props.area.likeCount,
            mediaWidth: viewportWidth / 4,
        };
    }

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

    render() {
        const {
            toggleAreaOptions,
            hashtags,
            isDarkMode,
            area,
            areaMedia,
            goToViewUser,
            inspectContent,
            areaUserDetails,
            theme,
            themeForms,
            themeViewArea,
        } = this.props;
        const dateTime = formatDate(area.createdAt);
        const dateStr = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;
        const toggleOptions = () => toggleAreaOptions(area);

        return (
            <View style={themeViewArea.styles.areaCard}>
                <View style={themeViewArea.styles.areaAuthorContainer}>
                    <Pressable
                        onPress={() => goToViewUser(area.fromUserId)}
                    >
                        <Image
                            source={{ uri: getUserImageUri({
                                details: {
                                    ...areaUserDetails,
                                    media: area.fromUserMedia || areaUserDetails.media,
                                    id: area.fromUserId || areaUserDetails.id,
                                },
                            }, 52) }}
                            style={themeViewArea.styles.areaUserAvatarImg}
                            containerStyle={themeViewArea.styles.areaUserAvatarImgContainer}
                            height={themeViewArea.styles.areaUserAvatarImg.height}
                            width={themeViewArea.styles.areaUserAvatarImg.width}
                            PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.brandingBlueGreen}/>}
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
                            {dateStr}
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
                        onPress={toggleOptions}
                        type="clear"
                    />
                </View>
                <View>
                    <AreaDisplayContent
                        hashtags={hashtags}
                        isDarkMode={isDarkMode}
                        area={area}
                        areaMedia={areaMedia}
                        goToViewUser={goToViewUser}
                        inspectContent={inspectContent}
                        onDoubleTap={() => this.onLikePress(area)}
                        onBookmarkPress={() => this.onBookmarkPress(area)}
                        theme={theme}
                        themeForms={themeForms}
                        themeViewArea={themeViewArea}
                        translate={this.props.translate}
                    />
                </View>
                {
                    area.distance != null &&
                    <Text style={themeViewArea.styles.areaDistanceRight}>{`${area.distance}`}</Text>
                }
            </View>
        );
    }
}

export const AreaDisplayContent = ({
    hashtags,
    isDarkMode,
    area,
    areaMedia,
    goToViewUser,
    inspectContent,
    onBookmarkPress,
    onDoubleTap,
    theme,
    themeForms,
    themeViewArea,
}: IAreaDisplayContentProps) => {
    // const [mediaWidth, setMediaWidth] = useState<number>(viewportWidth / 4);
    const [mediaWidth] = useState<number>(viewportWidth / 4);
    const isBookmarked = area.reaction?.userBookmarkCategory;
    // const onUserMediaLayout = (event) => {
    //     const { width } = event.nativeEvent.layout;
    //     setMediaWidth(width);
    // };

    const isQuickReport = Categories.QuickReportCategories.includes(area.category);

    return (
        <View style={localStyles.rowContainer}>
            <PresssableWithDoubleTap
                onPress={inspectContent}
                onDoubleTap={onDoubleTap || (() => {})}
                style={localStyles.mediaPressable}
            >
                <View style={[localStyles.mediaImageWrapper, {
                    width: mediaWidth,
                    height: mediaWidth,
                }]}>
                    {
                        areaMedia ?
                            <Image
                                source={{
                                    uri: areaMedia,
                                }}
                                style={[localStyles.mediaImage, {
                                    width: mediaWidth,
                                    height: mediaWidth,
                                }]}
                                resizeMode="contain"
                                PlaceholderContent={<ActivityIndicator />}
                            /> :
                            <MissingImagePlaceholder
                                area={area}
                                themeViewArea={themeViewArea}
                                dimensions={{
                                    width: mediaWidth,
                                    height: mediaWidth,
                                }}
                            />
                    }
                </View>
            </PresssableWithDoubleTap>
            <View style={spacingStyles.flexOne}>
                <View style={themeViewArea.styles.areaContentTitleContainer}>
                    <View style={localStyles.titleWithBadge}>
                        <Text
                            style={[themeViewArea.styles.areaContentTitleMedium, localStyles.titleText]}
                            numberOfLines={2}
                        >
                            {sanitizeNotificationMsg(area.notificationMsg)}
                        </Text>
                        {isQuickReport && (
                            <View style={[localStyles.quickReportBadge, { backgroundColor: theme.colors.brandingOrange }]}>
                                <Icon name="schedule" size={10} color={theme.colors.brandingWhite} />
                                <Text style={localStyles.quickReportBadgeText}>LIVE</Text>
                            </View>
                        )}
                    </View>
                    {
                        !area.isDraft && onBookmarkPress &&
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
                                onPress={onBookmarkPress}
                                type="clear"
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        </>
                    }
                </View>
                <RichText
                    style={themeViewArea.styles.areaMessage}
                    text={area.message}
                    linkStyle={theme.styles.link}
                    onMentionPress={goToViewUser ? (username) => handleMentionPress(username, goToViewUser) : undefined}
                    numberOfLines={3}
                />
                <View>
                    <HashtagsContainer
                        hasIcon={false}
                        hashtags={hashtags}
                        onHashtagPress={() => {}}
                        visibleCount={3}
                        right
                        styles={themeForms.styles}
                    />
                </View>
            </View>
        </View>
    );
};

const localStyles = StyleSheet.create({
    rowContainer: {
        display: 'flex',
        flexDirection: 'row',
        flex: 1,
    },
    mediaPressable: {
        paddingLeft: 14,
        paddingTop: 8,
    },
    mediaImageWrapper: {
        overflow: 'hidden',
        borderRadius: 7,
    },
    mediaImage: {
        borderRadius: 7,
    },
    titleWithBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        gap: 6,
    },
    titleText: {
        flexShrink: 1,
    },
    quickReportBadge: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 3,
    },
    quickReportBadgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
