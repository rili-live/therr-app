
import React, { useState } from 'react';
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
import { IUserState } from 'therr-react/types';
// import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';
import { getUserImageUri } from '../../utilities/content';
import PresssableWithDoubleTap from '../PressableWithDoubleTap';
// import { HAPTIC_FEEDBACK_TYPE } from '../../constants';
import formatDate from '../../utilities/formatDate';
import MissingImagePlaceholder from './MissingImagePlaceholder';

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
    mediaWidth: number;
}

export default class AreaDisplayMedium extends React.Component<IAreaDisplayMediumProps, IAreaDisplayMediumState> {
    constructor(props: IAreaDisplayMediumProps) {
        super(props);

        this.state = {
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

            updateAreaReaction(area.id, {
                userHasLiked: !area.reaction?.userHasLiked,
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
            <>
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
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <AreaDisplayContent
                    hashtags={hashtags}
                    isDarkMode={isDarkMode}
                    area={area}
                    areaMedia={areaMedia}
                    inspectContent={inspectContent}
                    onDoubleTap={() => this.onLikePress(area)}
                    onBookmarkPress={() => this.onBookmarkPress(area)}
                    theme={theme}
                    themeForms={themeForms}
                    themeViewArea={themeViewArea}
                    translate={this.props.translate}
                />
                {
                    area.distance != null &&
                    <Text  style={themeViewArea.styles.areaDistanceRight}>{`${area.distance}`}</Text>
                }
            </>
        );
    }
}

export const AreaDisplayContent = ({
    hashtags,
    isDarkMode,
    area,
    areaMedia,
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

    return (
        <View style={{ display: 'flex', flexDirection: 'row', flex: 1 }}>
            <PresssableWithDoubleTap
                onPress={inspectContent}
                onDoubleTap={onDoubleTap || (() => {})}
                style={{ paddingLeft: 14, paddingTop: 8 }}
            >
                {/* <UserMedia
                    viewportWidth={mediaWidth}
                    media={areaMedia}
                    isVisible={!!areaMedia}
                    isSingleView={false}
                    onLayout={onUserMediaLayout}
                /> */}
                {
                    areaMedia ?
                        <Image
                            source={{
                                uri: areaMedia,
                            }}
                            style={{
                                width: mediaWidth,
                                height: mediaWidth,
                                borderRadius: 7,
                            }}
                            resizeMode='contain'
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
            </PresssableWithDoubleTap>
            <View style={spacingStyles.flexOne}>
                <View style={themeViewArea.styles.areaContentTitleContainer}>
                    <Text
                        style={themeViewArea.styles.areaContentTitleMedium
                        }
                        numberOfLines={2}
                    >
                        {sanitizeNotificationMsg(area.notificationMsg)}
                    </Text>
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
                <Text style={themeViewArea.styles.areaMessage} numberOfLines={3}>
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
                        visibleCount={3}
                        right
                        styles={themeForms.styles}
                    />
                </View>
            </View>
        </View>
    );
};
