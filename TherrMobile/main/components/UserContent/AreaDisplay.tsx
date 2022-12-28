
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
import { IUserState } from 'therr-react/types';
import UserMedia from './UserMedia';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
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
    toggleAreaOptions: Function;
    hashtags: any[];
    isDarkMode: boolean;
    isExpanded?: boolean;
    area: any;
    areaMedia: string;
    goToViewUser: Function;
    goToViewMap: (lat: string, long: string) => any;
    inspectContent: () => any;
    updateAreaReaction: Function;
    user: IUserState;
    userDetails: IUserDetails;
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
}

export default class AreaDisplay extends React.Component<IAreaDisplayProps, IAreaDisplayState> {
    constructor(props: IAreaDisplayProps) {
        super(props);

        this.state = {
        };
    }

    onViewMapPress = (area) => {
        const { goToViewMap } = this.props;

        goToViewMap(area.latitude, area.longitude);
    }

    onBookmarkPress = (area) => {
        const { updateAreaReaction, userDetails } = this.props;

        updateAreaReaction(area.id, {
            userBookmarkCategory: area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, area.fromUserId, userDetails.userName);
    }

    onLikePress = (area) => {
        if (!area.isDraft) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);
            const { updateAreaReaction, userDetails } = this.props;

            updateAreaReaction(area.id, {
                userHasLiked: !area.reaction?.userHasLiked,
            }, area.fromUserId, userDetails.userName);
        }
    }

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
            userDetails,
            theme,
            themeForms,
            themeViewArea,
        } = this.props;

        const isBookmarked = area.reaction?.userBookmarkCategory;
        const isLiked = area.reaction?.userHasLiked;
        const likeColor = isLiked ? theme.colors.accentRed : (isDarkMode ? theme.colors.textWhite : theme.colors.tertiary);

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
                            PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.primary}/>}
                            transition={false}
                        />
                    </Pressable>
                    <View style={themeViewArea.styles.areaAuthorTextContainer}>
                        {
                            userDetails &&
                                <Text style={themeViewArea.styles.areaUserName} numberOfLines={1}>
                                    {`${userDetails.userName}`}
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
                        onPress={() => toggleAreaOptions(area)}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <PresssableWithDoubleTap
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
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        </>
                    }
                </View>
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
