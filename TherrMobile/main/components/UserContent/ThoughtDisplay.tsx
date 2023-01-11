
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
import TherrIcon from '../TherrIcon';


const hapticFeedbackOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
};

interface IUserDetails {
    media?: {
        profilePicture: any;
    };
    userName: string;
}

interface IThoughtDisplayProps {
    translate: Function;
    date: string;
    toggleThoughtOptions: Function;
    hashtags: any[];
    inspectThought: () => any;
    isDarkMode: boolean;
    isExpanded?: boolean;
    isRepliable?: boolean;
    thought: any;
    goToViewUser: Function;
    updateThoughtReaction: Function;
    user: IUserState;
    contentUserDetails: IUserDetails;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
    themeForms: {
        styles: any;
        colors: ITherrThemeColors;
    };
    themeViewContent: {
        styles: any;
        colors: ITherrThemeColors;
    };
}

interface IThoughtDisplayState {
}

class ThoughtDisplay extends React.Component<IThoughtDisplayProps, IThoughtDisplayState> {
    constructor(props: IThoughtDisplayProps) {
        super(props);

        this.state = {
        };
    }

    onBookmarkPress = (thought) => {
        const { updateThoughtReaction, user } = this.props;

        updateThoughtReaction(thought.id, {
            userBookmarkCategory: thought.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, thought.fromUserId, user?.details?.userName);
    }

    // TODO: Open full screen reply editor
    onCommentPress = () => {
        const { inspectThought } = this.props;

        inspectThought();
    }

    onLikePress = (thought) => {
        if (!thought.isDraft) {
            ReactNativeHapticFeedback.trigger('impactLight', hapticFeedbackOptions);
            const { updateThoughtReaction, user } = this.props;

            updateThoughtReaction(thought.id, {
                userHasLiked: !thought.reaction?.userHasLiked,
            }, thought.fromUserId, user?.details?.userName);
        }
    }

    render() {
        const {
            date,
            toggleThoughtOptions,
            hashtags,
            isDarkMode,
            // inspectThought,
            isExpanded,
            isRepliable,
            thought,
            goToViewUser,
            contentUserDetails,
            theme,
            themeForms,
            themeViewContent,
        } = this.props;

        const isBookmarked = thought.reaction?.userBookmarkCategory;
        const isLiked = thought.reaction?.userHasLiked;
        const likeColor = isLiked ? theme.colors.accentRed : (isDarkMode ? theme.colors.textWhite : theme.colors.tertiary);

        return (
            <>
                <View style={[themeViewContent.styles.thoughtContainer]}>
                    <View style={themeViewContent.styles.thoughtLeftContainer}>
                        <Pressable
                            onPress={() => goToViewUser(thought.fromUserId)}
                        >
                            <Image
                                source={{ uri: getUserImageUri({
                                    details: { media: thought.fromUserMedia || contentUserDetails.media, id: thought.fromUserId },
                                }, 52) }}
                                style={themeViewContent.styles.thoughtUserAvatarImg}
                                containerStyle={themeViewContent.styles.thoughtUserAvatarImgContainer}
                                PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.primary}/>}
                                transition={false}
                            />
                        </Pressable>
                    </View>
                    <View style={themeViewContent.styles.thoughtRightContainer}>
                        <View style={themeViewContent.styles.thoughtAuthorContainer}>
                            <View style={themeViewContent.styles.thoughtAuthorTextContainer}>
                                {
                                    contentUserDetails &&
                                        <Text style={themeViewContent.styles.thoughtUserName} numberOfLines={1}>
                                            {`${contentUserDetails.userName}`}
                                        </Text>
                                }
                                <Text style={themeViewContent.styles.dateTime}>
                                    {date}
                                </Text>
                            </View>
                            <Button
                                containerStyle={themeViewContent.styles.moreButtonContainer}
                                buttonStyle={themeViewContent.styles.moreButton}
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
                        {
                            !isExpanded &&
                                <ThoughtContent
                                    hashtags={hashtags}
                                    isBookmarked={isBookmarked}
                                    isExpanded={isExpanded}
                                    isDarkMode={isDarkMode}
                                    isLiked={isLiked}
                                    isRepliable={isRepliable}
                                    likeColor={likeColor}
                                    onBookmarkPress={this.onBookmarkPress}
                                    onCommentPress={this.onCommentPress}
                                    onLikePress={this.onLikePress}
                                    theme={theme}
                                    themeForms={themeForms}
                                    themeViewContent={themeViewContent}
                                    thought={thought}
                                />
                        }
                    </View>
                </View>
                {
                    isExpanded &&
                        <ThoughtContent
                            hashtags={hashtags}
                            isBookmarked={isBookmarked}
                            isExpanded={isExpanded}
                            isDarkMode={isDarkMode}
                            isLiked={isLiked}
                            isRepliable={isRepliable}
                            likeColor={likeColor}
                            onBookmarkPress={this.onBookmarkPress}
                            onCommentPress={this.onCommentPress}
                            onLikePress={this.onLikePress}
                            theme={theme}
                            themeForms={themeForms}
                            themeViewContent={themeViewContent}
                            thought={thought}
                        />
                }
            </>
        );
    }
}

const ThoughtContent = ({
    hashtags,
    isBookmarked,
    isDarkMode,
    isExpanded,
    isLiked,
    isRepliable,
    likeColor,
    onBookmarkPress,
    onCommentPress,
    onLikePress,
    theme,
    themeForms,
    themeViewContent,
    thought,
}) => {
    return (
        <View style={themeViewContent.styles.thoughtContentContainer}>
            <View style={spacingStyles.flexOne}>
                <Text style={themeViewContent.styles.thoughtMessage} numberOfLines={isExpanded ? undefined : 7}>
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
                        visibleCount={isExpanded ? 20 : 4}
                        right
                        styles={themeForms.styles}
                    />
                </View>
                <View style={isExpanded ? themeViewContent.styles.thoughtReactionsContainerExpanded : themeViewContent.styles.thoughtReactionsContainer}>
                    {
                        !thought.isDraft && isRepliable &&
                        <>
                            <Button
                                containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                icon={
                                    <TherrIcon
                                        name="chat"
                                        size={22}
                                        color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                    />
                                }
                                onPress={() => onCommentPress(thought)}
                                type="clear"
                                title={thought.replies?.length ? thought.replies.length : ''}
                                titleStyle={[
                                    themeViewContent.styles.thoughtReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                            <Button
                                containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                icon={
                                    <TherrIcon
                                        name={ isBookmarked ? 'bookmark-filled' : 'bookmark' }
                                        size={22}
                                        color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                    />
                                }
                                onPress={() => onBookmarkPress(thought)}
                                type="clear"
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                            <Button
                                containerStyle={themeViewContent.styles.areaReactionButtonContainer}
                                buttonStyle={themeViewContent.styles.areaReactionButton}
                                icon={
                                    <TherrIcon
                                        name={ isLiked ? 'heart-filled' : 'heart' }
                                        size={22}
                                        color={likeColor}
                                    />
                                }
                                onPress={() => onLikePress(thought)}
                                type="clear"
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        </>
                    }
                </View>
            </View>
        </View>
    );
};

export default ThoughtDisplay;
