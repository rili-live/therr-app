
import React from 'react';
import {
    ActivityIndicator,
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
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';
import { getUserImageUri } from '../../utilities/content';

const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

interface IUserDetails {
    userName: string;
}

interface IThoughtDisplayProps {
    translate: Function;
    date: string;
    toggleThoughtOptions: Function;
    hashtags: any[];
    inspectThought: () => any;
    isDarkMode: boolean;
    thought: any;
    goToViewUser: Function;
    updateThoughtReaction: Function;
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

interface IThoughtDisplayState {
}

export default class ThoughtDisplay extends React.Component<IThoughtDisplayProps, IThoughtDisplayState> {
    constructor(props: IThoughtDisplayProps) {
        super(props);

        this.state = {
        };
    }

    onBookmarkPress = (thought) => {
        const { updateThoughtReaction, userDetails } = this.props;

        updateThoughtReaction(thought.id, {
            userBookmarkCategory: thought.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, thought.fromUserId, userDetails.userName);
    }

    onLikePress = (thought) => {
        if (!thought.isDraft) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);
            const { updateThoughtReaction, userDetails } = this.props;

            updateThoughtReaction(thought.id, {
                userHasLiked: !thought.reaction?.userHasLiked,
            }, thought.fromUserId, userDetails.userName);
        }
    }

    render() {
        const {
            date,
            toggleThoughtOptions,
            hashtags,
            isDarkMode,
            // inspectThought,
            thought,
            goToViewUser,
            userDetails,
            theme,
            themeForms,
            themeViewArea,
        } = this.props;

        const isBookmarked = thought.reaction?.userBookmarkCategory;

        return (
            <>
                <View style={themeViewArea.styles.areaAuthorContainer}>
                    <Pressable
                        onPress={() => goToViewUser(thought.fromUserId)}
                    >
                        <Image
                            source={{ uri: getUserImageUri({ details: { media: thought.fromUserMedia, id: thought.fromUserId } }, 52) }}
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
                        onPress={() => toggleThoughtOptions(thought)}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <View style={{ display: 'flex', flexDirection: 'row' }}>
                    <View style={spacingStyles.flexOne}>
                        <View style={themeViewArea.styles.areaContentTitleContainer}>
                            <Text
                                style={themeViewArea.styles.areaContentTitleMedium
                                }
                                numberOfLines={2}
                            ></Text>
                            {
                                !thought.isDraft &&
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
                                        onPress={() => this.onBookmarkPress(thought)}
                                        type="clear"
                                        TouchableComponent={TouchableWithoutFeedbackComponent}
                                    />
                                </>
                            }
                        </View>
                        <Text style={themeViewArea.styles.areaMessage} numberOfLines={3}>
                            <Autolink
                                text={thought.message}
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
            </>
        );
    }
}
