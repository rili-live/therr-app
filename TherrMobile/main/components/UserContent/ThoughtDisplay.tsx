
import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    Text,
    TouchableWithoutFeedbackComponent,
    View,
} from 'react-native';
import { Button } from '../BaseButton';
import { Image } from '../BaseImage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { IUserState } from 'therr-react/types';
import HashtagsContainer from './HashtagsContainer';
import { ITherrThemeColors } from '../../styles/themes';
import spacingStyles from '../../styles/layouts/spacing';
import { getUserImageUri } from '../../utilities/content';
import TherrIcon from '../TherrIcon';
import RichText from '../RichText';
import handleMentionPress from '../../utilities/handleMentionPress';
import formatDate from '../../utilities/formatDate';
import { formatCrossBrandMessage } from '../../utilities/crossBrandPostLabel';
import SuperUserStatusIcon from '../SuperUserStatusIcon';

// const hapticFeedbackOptions = {
//     enableVibrateFallback: false,
//     ignoreAndroidSystemSettings: false,
// };

interface IUserDetails {
    media?: {
        profilePicture: any;
    };
    userName: string;
    isSuperUser?: boolean;
}

interface IThoughtDisplayProps {
    translate: Function;
    toggleThoughtOptions: Function;
    hashtags: any[];
    inspectThought: (thought: any) => any;
    isDarkMode: boolean;
    isExpanded?: boolean;
    isRepliable?: boolean;
    thought: any;
    topReply?: any;
    replyCount?: number;
    /**
     * Renders a standalone action row for content that is not itself repliable (ie. replies
     * rendered within the thought details view): a reply-count icon that inspects the nested
     * thought, and a like control. Off by default so feed/carousel displays are unaffected.
     */
    showThreadActions?: boolean;
    /**
     * Opens the repost composer for this thought. Optional: the repost control only renders
     * where a screen has wired one up, so surfaces that show thoughts read-only (a carousel
     * without a composer, say) are unaffected.
     */
    onRepostPress?: (thought: any) => void;
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
    isLiked: boolean;
    isBookmarked: boolean;
    likeCount: number | null;
}

class ThoughtDisplay extends React.Component<IThoughtDisplayProps, IThoughtDisplayState> {
    static getDerivedStateFromProps(nextProps: IThoughtDisplayProps, nextState: IThoughtDisplayState) {
        if (nextProps.thought?.likeCount != null
            && nextState.likeCount == null) {
            return {
                isLiked: !!nextProps.thought.reaction?.userHasLiked,
                isBookmarked: !!nextProps.thought.reaction?.userBookmarkCategory,
                likeCount: nextProps.thought?.likeCount,
            };
        }

        return null;
    }

    constructor(props: IThoughtDisplayProps) {
        super(props);

        this.state = {
            isLiked: !!props.thought.reaction?.userHasLiked,
            isBookmarked: !!props.thought.reaction?.userBookmarkCategory,
            likeCount: props.thought.likeCount,
        };
    }

    onBookmarkPress = (thought) => {
        const { updateThoughtReaction, user } = this.props;
        const previousIsBookmarked = this.state.isBookmarked;
        const newIsBookmarked = !previousIsBookmarked;

        this.setState({
            isBookmarked: newIsBookmarked,
        });

        const request = updateThoughtReaction(thought.id, {
            userBookmarkCategory: newIsBookmarked ? 'Uncategorized' : null,
        }, thought.fromUserId, user?.details?.userName);

        // Not every caller returns the request (some fire-and-forget through an action sheet),
        // so this is opt-in: when we can see the failure, undo the optimistic toggle.
        request?.catch?.(() => this.setState({ isBookmarked: previousIsBookmarked }));
    };

    // TODO: Open full screen reply editor
    onCommentPress = () => {
        const { inspectThought, thought } = this.props;

        inspectThought(thought);
    };

    onLikePress = (thought) => {
        if (!thought.isDraft) {
            // ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);
            const { updateThoughtReaction, user } = this.props;
            const previousIsLiked = this.state.isLiked;
            const previousLikeCount = this.state.likeCount;
            const newIsLiked = !previousIsLiked;

            this.setState({
                isLiked: newIsLiked,
                likeCount: this.props.thought.likeCount != null
                    ? Math.max((previousLikeCount || 0) + (newIsLiked ? 1 : -1), 0)
                    : previousLikeCount,
            });

            const request = updateThoughtReaction(thought.id, {
                userHasLiked: newIsLiked,
            }, thought.fromUserId, user?.details?.userName);

            request?.catch?.(() => this.setState({
                isLiked: previousIsLiked,
                likeCount: previousLikeCount,
            }));
        }
    };

    render() {
        const {
            translate,
            toggleThoughtOptions,
            hashtags,
            isDarkMode,
            inspectThought,
            isExpanded,
            isRepliable,
            thought,
            topReply,
            replyCount,
            showThreadActions,
            onRepostPress,
            goToViewUser,
            contentUserDetails,
            theme,
            themeForms,
            themeViewContent,
        } = this.props;
        const { isLiked, isBookmarked, likeCount } = this.state;

        const likeColor = isLiked ? theme.colors.accentRed : (isDarkMode ? theme.colors.textWhite : theme.colors.tertiary);
        const dateTime = formatDate(thought.createdAt);
        const dateStr = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;

        return (
            <View style={themeViewContent.styles.thoughtCard}>
                {
                    // Attribution sits above the author row rather than inside it, so the card
                    // still reads as "posted by <reposter>" — the embed below carries the
                    // original author's identity.
                    !!thought.isRepost &&
                        <View style={themeViewContent.styles.repostAttributionContainer}>
                            <Icon
                                name="repeat"
                                size={14}
                                color={isDarkMode ? theme.colors.textWhite : theme.colors.textGray}
                            />
                            <Text style={themeViewContent.styles.repostAttributionText} numberOfLines={1}>
                                {translate('components.thoughtDisplay.repostedBy', {
                                    userName: contentUserDetails?.userName || '',
                                })}
                            </Text>
                        </View>
                }
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
                                PlaceholderContent={<ActivityIndicator size="small" color={theme.colors.brandingBlueGreen}/>}
                                transition={false}
                            />
                        </Pressable>
                    </View>
                    <View style={themeViewContent.styles.thoughtRightContainer}>
                        <View style={themeViewContent.styles.thoughtAuthorContainer}>
                            <View style={themeViewContent.styles.thoughtAuthorTextContainer}>
                                {
                                    contentUserDetails &&
                                        <View style={[
                                            spacingStyles.flexRow,
                                            spacingStyles.alignCenter,
                                        ]}>
                                            <Text style={themeViewContent.styles.thoughtUserName} numberOfLines={1}>
                                                {`${contentUserDetails.userName}`}
                                            </Text>
                                            <SuperUserStatusIcon
                                                isSuperUser={contentUserDetails.isSuperUser}
                                                size={14}
                                                isDarkMode={isDarkMode}
                                                style={[
                                                    {
                                                        marginBottom: themeViewContent.styles.thoughtUserName.marginBottom,
                                                    },
                                                    spacingStyles.padLtTiny,
                                                ]}
                                            />
                                        </View>
                                }
                                <Text style={themeViewContent.styles.dateTime}>
                                    {dateStr}
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
                                    likeCount={likeCount}
                                    isRepliable={isRepliable}
                                    likeColor={likeColor}
                                    inspectThought={inspectThought}
                                    onBookmarkPress={this.onBookmarkPress}
                                    onCommentPress={this.onCommentPress}
                                    onLikePress={this.onLikePress}
                                    goToViewUser={goToViewUser}
                                    onRepostPress={onRepostPress}
                                    replyCount={replyCount}
                                    showThreadActions={showThreadActions}
                                    theme={theme}
                                    themeForms={themeForms}
                                    themeViewContent={themeViewContent}
                                    thought={thought}
                                    translate={translate}
                                />
                        }
                    </View>
                </View>
                {
                    !isExpanded && !!topReply &&
                        <ThreadPreview
                            goToViewUser={goToViewUser}
                            inspectThought={inspectThought}
                            replyCount={replyCount ?? thought.replies?.length ?? 0}
                            theme={theme}
                            themeViewContent={themeViewContent}
                            thought={thought}
                            topReply={topReply}
                            translate={translate}
                        />
                }
                {
                    isExpanded &&
                        <View>
                            <ThoughtContent
                                hashtags={hashtags}
                                isBookmarked={isBookmarked}
                                isExpanded={isExpanded}
                                isDarkMode={isDarkMode}
                                isLiked={isLiked}
                                isRepliable={isRepliable}
                                likeColor={likeColor}
                                likeCount={likeCount}
                                inspectThought={inspectThought}
                                onBookmarkPress={this.onBookmarkPress}
                                onCommentPress={this.onCommentPress}
                                onLikePress={this.onLikePress}
                                goToViewUser={goToViewUser}
                                onRepostPress={onRepostPress}
                                replyCount={replyCount}
                                showThreadActions={showThreadActions}
                                theme={theme}
                                themeForms={themeForms}
                                themeViewContent={themeViewContent}
                                thought={thought}
                                translate={translate}
                            />
                        </View>
                }
            </View>
        );
    }
}

const ThreadPreview = ({
    goToViewUser,
    inspectThought,
    replyCount,
    theme,
    themeViewContent,
    thought,
    topReply,
    translate,
}) => {
    const onMentionPress = (username: string) => handleMentionPress(username, goToViewUser);

    return (
        <Pressable style={themeViewContent.styles.threadPreviewContainer} onPress={() => inspectThought(thought)}>
            <Pressable
                style={themeViewContent.styles.threadPreviewAvatarImgContainer}
                onPress={() => goToViewUser(topReply.fromUserId)}
            >
                <Image
                    source={{ uri: getUserImageUri({
                        details: { media: topReply.fromUserMedia, id: topReply.fromUserId },
                    }, 32) }}
                    style={themeViewContent.styles.threadPreviewAvatarImg}
                    transition={false}
                />
            </Pressable>
            <View style={themeViewContent.styles.threadPreviewContentContainer}>
                {
                    !!topReply.fromUserName &&
                    <Text style={themeViewContent.styles.threadPreviewUserName} numberOfLines={1}>
                        {topReply.fromUserName}
                    </Text>
                }
                <RichText
                    style={themeViewContent.styles.threadPreviewMessage}
                    text={topReply.message}
                    linkStyle={theme.styles.link}
                    onMentionPress={onMentionPress}
                    numberOfLines={3}
                />
                {
                    replyCount > 1 &&
                    <Text style={themeViewContent.styles.threadPreviewViewAllText}>
                        {translate('components.thoughtDisplay.viewAllReplies', { count: replyCount })}
                    </Text>
                }
            </View>
        </Pressable>
    );
};

/**
 * The original post embedded inside a repost. Tapping it opens the original rather than the
 * repost, so a reader can always reach the source in one gesture.
 *
 * `repostOf` is null whenever the original is deleted, mature-flagged, or outside the reader's
 * brand — all of which the backend resolves to the same "no embed" answer. Rendering an
 * explicit unavailable line rather than nothing keeps a plain (unquoted) repost from
 * collapsing into a blank card with no explanation.
 */
const RepostEmbed = ({
    goToViewUser,
    inspectThought,
    theme,
    themeViewContent,
    repostOf,
    translate,
}) => {
    const onMentionPress = (username: string) => handleMentionPress(username, goToViewUser);

    if (!repostOf) {
        return (
            <View style={themeViewContent.styles.repostEmbedContainer}>
                <Text style={themeViewContent.styles.repostEmbedUnavailableText}>
                    {translate('components.thoughtDisplay.repostUnavailable')}
                </Text>
            </View>
        );
    }

    const dateTime = formatDate(repostOf.createdAt);
    const dateStr = !dateTime.date ? '' : `${dateTime.date} | ${dateTime.time}`;

    return (
        <Pressable
            style={themeViewContent.styles.repostEmbedContainer}
            onPress={() => inspectThought(repostOf)}
        >
            <View style={themeViewContent.styles.repostEmbedHeader}>
                <Image
                    source={{ uri: getUserImageUri({
                        details: { media: repostOf.fromUserMedia, id: repostOf.fromUserId },
                    }, 32) }}
                    style={themeViewContent.styles.repostEmbedAvatarImg}
                    transition={false}
                />
                <Text style={themeViewContent.styles.repostEmbedUserName} numberOfLines={1}>
                    {repostOf.fromUserName || ''}
                </Text>
                <Text style={themeViewContent.styles.repostEmbedDateTime}>
                    {dateStr}
                </Text>
            </View>
            <RichText
                style={themeViewContent.styles.repostEmbedMessage}
                text={repostOf.message}
                linkStyle={theme.styles.link}
                onMentionPress={onMentionPress}
                numberOfLines={5}
            />
        </Pressable>
    );
};

const ThoughtContent = ({
    hashtags,
    isBookmarked,
    isDarkMode,
    isExpanded,
    isLiked,
    isRepliable,
    likeColor,
    likeCount,
    inspectThought,
    onBookmarkPress,
    onCommentPress,
    onLikePress,
    onRepostPress,
    goToViewUser,
    replyCount,
    showThreadActions,
    theme,
    themeForms,
    themeViewContent,
    thought,
    translate,
}) => {
    const totalReplies = replyCount ?? thought.replyCount ?? thought.replies?.length;
    const onMentionPress = (username: string) => handleMentionPress(username, goToViewUser);
    // A post written in another Therr-family app (a Friends with Habits goal, say) reads as
    // a bare sentence here with nothing saying where it came from. See crossBrandPostLabel.
    const message = formatCrossBrandMessage({
        message: thought.message,
        brandVariation: thought.brandVariation,
        parentId: thought.parentId,
        translate,
    });
    const hasRepliableActions = !thought.isDraft && isRepliable;
    const totalReposts = thought.repostCount ?? 0;
    // Drafts have no id the server would accept as a repost target, and a repost of a repost
    // is collapsed to the root server-side — so offering the control on one would silently
    // re-share something other than what the reader tapped.
    const canRepost = !!onRepostPress && !thought.isDraft && !thought.isRepost;
    const repostButtonTitle = totalReposts > 0 ? `${totalReposts}` : '';
    // The repliable action row already renders a reply icon/count and a like control, so this
    // only fills the gap for non-repliable content (replies within the thought details view).
    const shouldShowThreadActions = !hasRepliableActions && !thought.isDraft && showThreadActions;

    return (
        <Pressable style={themeViewContent.styles.thoughtContentContainer} onPress={() => inspectThought(thought)}>
            <View style={spacingStyles.flexOne}>
                <RichText
                    style={themeViewContent.styles.thoughtMessage}
                    text={message}
                    linkStyle={theme.styles.link}
                    onMentionPress={onMentionPress}
                    numberOfLines={isExpanded ? undefined : 7}
                />
                {
                    !!thought.isRepost &&
                        <RepostEmbed
                            goToViewUser={goToViewUser}
                            inspectThought={inspectThought}
                            theme={theme}
                            themeViewContent={themeViewContent}
                            repostOf={thought.repostOf}
                            translate={translate}
                        />
                }
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
                        shouldShowThreadActions &&
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
                                onPress={() => inspectThought(thought)}
                                type="clear"
                                title={`${totalReplies || 0}`}
                                titleStyle={[
                                    themeViewContent.styles.thoughtReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                accessibilityLabel={translate('components.thoughtDisplay.viewReplies', { count: totalReplies || 0 })}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                            {
                                canRepost &&
                                <Button
                                    containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                    buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                    icon={
                                        <Icon
                                            name="repeat"
                                            size={22}
                                            color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                        />
                                    }
                                    onPress={() => onRepostPress(thought)}
                                    type="clear"
                                    title={repostButtonTitle}
                                    titleStyle={[
                                        themeViewContent.styles.thoughtReactionButtonTitle,
                                        { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                    ]}
                                    accessibilityLabel={translate('components.thoughtDisplay.repostThought')}
                                    TouchableComponent={TouchableWithoutFeedbackComponent}
                                />
                            }
                            {/*
                                The like control is deliberately its own pressable rather than part
                                of the card's inspect gesture — liking a reply should not first
                                require opening it.
                            */}
                            <Button
                                containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                icon={
                                    <TherrIcon
                                        name={ isLiked ? 'heart-filled' : 'heart' }
                                        size={22}
                                        color={likeColor}
                                    />
                                }
                                onPress={() => onLikePress(thought)}
                                type="clear"
                                title={(likeCount && likeCount > 0) ? likeCount.toString() : ''}
                                titleStyle={[
                                    themeViewContent.styles.thoughtReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                accessibilityLabel={translate(isLiked
                                    ? 'components.thoughtDisplay.unlikeThought'
                                    : 'components.thoughtDisplay.likeThought')}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        </>
                    }
                    {
                        hasRepliableActions &&
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
                                title={totalReplies ? `${totalReplies}` : ''}
                                titleStyle={[
                                    themeViewContent.styles.thoughtReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                            {
                                thought?.viewCount != null &&
                                <Button
                                    containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                    buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                    icon={
                                        <TherrIcon
                                            name="bar-chart"
                                            size={22}
                                            color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                        />
                                    }
                                    onPress={() => {}}
                                    type="clear"
                                    title={thought?.viewCount}
                                    titleStyle={[
                                        themeViewContent.styles.thoughtReactionButtonTitle,
                                        { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                    ]}
                                    TouchableComponent={TouchableWithoutFeedbackComponent}
                                />
                            }
                            {
                                canRepost &&
                                <Button
                                    containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                    buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                    icon={
                                        <Icon
                                            name="repeat"
                                            size={22}
                                            color={isDarkMode ? theme.colors.textWhite : theme.colors.tertiary}
                                        />
                                    }
                                    onPress={() => onRepostPress(thought)}
                                    type="clear"
                                    title={repostButtonTitle}
                                    titleStyle={[
                                        themeViewContent.styles.thoughtReactionButtonTitle,
                                        { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                    ]}
                                    accessibilityLabel={translate('components.thoughtDisplay.repostThought')}
                                    TouchableComponent={TouchableWithoutFeedbackComponent}
                                />
                            }
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
                                containerStyle={themeViewContent.styles.thoughtReactionButtonContainer}
                                buttonStyle={themeViewContent.styles.thoughtReactionButton}
                                icon={
                                    <TherrIcon
                                        name={ isLiked ? 'heart-filled' : 'heart' }
                                        size={22}
                                        color={likeColor}
                                    />
                                }
                                onPress={() => onLikePress(thought)}
                                type="clear"
                                title={(likeCount && likeCount > 0) ? likeCount.toString() : ''}
                                titleStyle={[
                                    themeViewContent.styles.thoughtReactionButtonTitle,
                                    { color: isDarkMode ? theme.colors.textWhite : theme.colors.tertiary },
                                ]}
                                TouchableComponent={TouchableWithoutFeedbackComponent}
                            />
                        </>
                    }
                </View>
            </View>
        </Pressable>
    );
};

export default ThoughtDisplay;
