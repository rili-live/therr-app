
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
import { IUserState } from 'therr-react/types';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import UserMedia from './UserMedia';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';
import { getUserImageUri } from '../../utilities/content';
import PresssableWithDoubleTap from '../PressableWithDoubleTap';

const { width: viewportWidth } = Dimensions.get('window');

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

interface IUserDetails {
    userName: string;
}

interface IAreaDisplayMediumProps {
    translate: Function;
    date: string;
    toggleAreaOptions: Function;
    hashtags: any[];
    isDarkMode: boolean;
    area: any;
    areaMedia: string;
    goToViewUser: Function;
    goToViewMap: (lat: string, long: string) => any;
    inspectArea: () => any;
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

interface IAreaDisplayMediumState {
}

export default class AreaDisplayMedium extends React.Component<IAreaDisplayMediumProps, IAreaDisplayMediumState> {
    constructor(props: IAreaDisplayMediumProps) {
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
            area,
            areaMedia,
            goToViewUser,
            inspectArea,
            userDetails,
            theme,
            themeForms,
            themeViewArea,
        } = this.props;

        const isBookmarked = area.reaction?.userBookmarkCategory;

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
                <View style={{ display: 'flex', flexDirection: 'row' }}>
                    <PresssableWithDoubleTap
                        onPress={inspectArea}
                        onDoubleTap={() => this.onLikePress(area)}
                        style={{ paddingLeft: 14, paddingTop: 8 }}
                    >
                        <UserMedia
                            viewportWidth={viewportWidth / 4}
                            media={areaMedia}
                            isVisible={!!areaMedia}
                            isSingleView={false}
                        />
                    </PresssableWithDoubleTap>
                    <View style={{ flex: 1 }}>
                        <View style={themeViewArea.styles.areaContentTitleContainer}>
                            <Text
                                style={themeViewArea.styles.areaContentTitleMedium
                                }
                                numberOfLines={2}
                            >
                                {sanitizeNotificationMsg(area.notificationMsg)}
                            </Text>
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
                {
                    area.distance != null &&
                    <Text  style={themeViewArea.styles.areaDistance}>{`${area.distance} mi`}</Text>
                }
            </>
        );
    }
}
