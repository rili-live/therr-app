import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Keyboard,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button as PaperButton, Divider, Text as PaperText, TextInput as PaperTextInput } from 'react-native-paper';
import { KeyboardAwareScrollView, KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { IContentState, IUserState } from 'therr-react/types';
import { FeatureFlags } from 'therr-js-utilities/constants';
import { ContentActions } from 'therr-react/redux/actions';
import UsersActions from '../../redux/actions/UsersActions';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import getConfig from '../../utilities/getConfig';
import translator from '../../utilities/translator';
import { isDarkTheme } from '../../styles/themes';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildThoughtStyles } from '../../styles/user-content/thoughts/viewing';
import { buildStyles as buildConfirmModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonsStyles } from '../../styles/buttons';
import ThoughtDisplay from '../../components/UserContent/ThoughtDisplay';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import BaseStatusBar from '../../components/BaseStatusBar';
import { isMyContent as checkIsMyContent } from '../../utilities/content';
import { SheetManager } from 'react-native-actions-sheet';
import { IContentSelectionType } from '../../components/ActionSheet/ContentOptionsSheet';
import { getReactionUpdateArgs } from '../../utilities/reactions';
import TherrIcon from '../../components/TherrIcon';
import { HAPTIC_FEEDBACK_TYPE } from '../../constants';
import { navToViewContent } from '../../utilities/postViewHelpers';
import { showToast } from '../../utilities/toasts';

const localStyles = StyleSheet.create({
    contentContainer: {
        paddingHorizontal: 10,
    },
    replyInput: {
        flex: 1,
        fontSize: 16,
        backgroundColor: 'transparent',
    },
    /**
     * `maxHeight` belongs on the native input (`contentStyle`), not on the Paper container
     * (`style`): Paper only pins an explicit height on a multiline input when one is passed in
     * `style`, so a cap set there would clip the text instead of letting the input scroll. On the
     * native input it caps growth at roughly five lines and hands overflow to the input's own
     * scroll.
     */
    replyInputContent: {
        maxHeight: 120,
    },
    replyInputOutline: {
        borderRadius: 20,
    },
    footerButton: {
        flex: 1,
        marginHorizontal: 6,
    },
});

const hapticFeedbackOptions = {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
};

const SendIcon = ({ disabled, colors }: { disabled: boolean; colors: { active: string; inactive: string } }) => (
    <TherrIcon name="send" size={22} color={disabled ? colors.inactive : colors.active} />
);

/**
 * Signals that the post being viewed is a reply, and doubles as the way back up to the post it
 * replies to. Without it a reply is indistinguishable from a top-level thought: it renders in the
 * same card, and its own replies read as the whole conversation.
 */
const ParentThoughtBanner = ({
    isDarkMode,
    onPress,
    parentThought,
    theme,
    themeViewContent,
    translate,
}: {
    isDarkMode: boolean;
    onPress: () => void;
    parentThought: any;
    theme: any;
    themeViewContent: any;
    translate: Function;
}) => {
    const mutedColor = isDarkMode ? theme.colorVariations?.accentTextWhiteFade : theme.colors.tertiary;
    // The author is only known once the details fetch resolves (and never for a deleted account),
    // so the label degrades to the generic wording rather than rendering "Replying to undefined".
    const label = parentThought.fromUserName
        ? translate('pages.viewThought.replyingTo', { userName: parentThought.fromUserName })
        : translate('pages.viewThought.partOfThread');

    return (
        <Pressable
            style={themeViewContent.styles.parentThoughtContainer}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={translate('pages.viewThought.viewParentThought')}
        >
            <TherrIcon
                name="chat"
                size={18}
                color={theme.colors.brand}
            />
            <View style={themeViewContent.styles.parentThoughtTextContainer}>
                <Text style={themeViewContent.styles.parentThoughtLabel} numberOfLines={1}>
                    {label}
                </Text>
                {
                    !!parentThought.message &&
                        <Text style={themeViewContent.styles.parentThoughtMessage} numberOfLines={2}>
                            {parentThought.message}
                        </Text>
                }
            </View>
            <TherrIcon
                name="chevron-right"
                size={18}
                color={mutedColor}
            />
        </Pressable>
    );
};

interface IViewThoughtDispatchProps {
    getThoughtDetails: Function;
    deleteThought: Function;
    createThought: Function;
    createOrUpdateThoughtReaction: Function;
}

interface IStoreProps extends IViewThoughtDispatchProps {
    content: IContentState;
    user: IUserState;
}

export interface IViewThoughtProps extends IStoreProps {
    navigation: any;
    route: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createThought: UsersActions.createThought,
    getThoughtDetails: UsersActions.getThoughtDetails,
    deleteThought: UsersActions.deleteThought,
    createOrUpdateThoughtReaction: ContentActions.createOrUpdateThoughtReaction,
}, dispatch);

const ViewThought = ({
    user,
    navigation,
    route,
    createThought,
    getThoughtDetails,
    deleteThought,
    createOrUpdateThoughtReaction,
}: IViewThoughtProps) => {
    const translate = useCallback(
        (key: string, params?: any) => translator(user.settings?.locale || 'en-us', key, params),
        [user.settings?.locale]
    );

    // State
    const [replies, setReplies] = useState<any[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
    const [fetchedThought, setFetchedThought] = useState<any>({});

    // Refs
    const scrollViewRef = useRef<any>(null);
    const replyInputRef = useRef<any>(null);

    // Keyboard (selector keeps re-renders to visibility changes rather than every frame of the
    // keyboard animation)
    const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

    // Themes
    const theme = buildStyles(user.settings?.mobileThemeName);
    const themeAccentLayout = buildAccentStyles(user.settings?.mobileThemeName);
    const themeThought = buildThoughtStyles(user.settings?.mobileThemeName, true);
    const themeForms = buildFormStyles(user.settings?.mobileThemeName);
    const themeConfirmModal = buildConfirmModalStyles(user.settings?.mobileThemeName);
    const themeButtons = buildButtonsStyles(user.settings?.mobileThemeName);
    const isDarkMode = isDarkTheme(user.settings?.mobileThemeName);

    // Derived values
    const { thought, isMyContent, previousView } = route.params;
    const thoughtUserName = isMyContent ? user.details.userName : thought.fromUserName;
    const thoughtInView = useMemo(() => ({
        ...thought,
        ...fetchedThought,
    }), [thought, fetchedThought]);
    const hashtags = useMemo(
        () => (thought.hashTags ? thought.hashTags.split(',') : []),
        [thought.hashTags]
    );
    // Present only when this post is a reply. The details fetch is the source of truth, but a
    // thought handed over through route params (eg. a reply opened from within a thread) can
    // already carry it, so the banner renders before the fetch resolves.
    const parentThought = fetchedThought?.parent || thought.parent;
    const isFormDisabled = !inputMessage || isSubmitting;
    const brandColor = isDarkMode ? theme.colors.textWhite : theme.colors.brandingBlueGreen;

    // Fetch thought details and set up nav listener
    useEffect(() => {
        getThoughtDetails(thought.id, {
            withUser: true,
            withReplies: true,
            withParent: true,
        }).then((response) => {
            setFetchedThought(response?.thought || {});
            setReplies(
                // The id filter guards against a backend that has not yet shipped the
                // phantom-reply fix: an id-less reply renders as an empty card, inflates the
                // reply count, and cannot be opened.
                response?.thought?.replies?.filter((reply) => !!reply?.id).sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ) || []
            );
        }).catch(() => {
            // Deliberately not navigating away: the thought passed through route params is
            // enough to render the post itself, and bouncing the user back to the feed on a
            // transient failure reads as "tapping a reply does nothing".
            showToast.error({
                text1: translate('alertTitles.backendErrorMessage'),
                text2: translate('pages.viewThought.repliesFailed'),
            });
        });

        const unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // Placeholder for future nav bar color changes
        });

        return () => {
            unsubscribeNavListener();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The parent is only known once the details fetch resolves, so the header title is corrected
    // afterwards — "Reply" is the first signal that this post is part of a bigger thread. Both
    // branches are set rather than only the reply one, so the title stays a function of the
    // thought on screen: this screen is reused via `navigation.replace` when walking up out of a
    // reply, and a one-way override would leave the parent's own view still titled "Reply".
    useEffect(() => {
        navigation.setOptions({
            title: parentThought?.id
                ? translate('pages.viewThought.headerTitleReply')
                : translate('pages.viewThought.headerTitle'),
        });
    }, [parentThought?.id, navigation, translate]);

    // Handlers
    const handleGoBack = useCallback(() => {
        // Nested replies are pushed onto the stack, so unwinding one level is a plain pop.
        if (previousView === 'ViewThought' && navigation.canGoBack()) {
            navigation.goBack();
        } else if (fetchedThought?.parentId) {
            // Reached without a parent screen below (eg. a push notification deep link into a
            // reply), so walk up to the parent thought explicitly. The fetched parent is handed
            // over whole when we have it, so that screen renders the post immediately instead of
            // an empty card until its own details request resolves.
            navToViewContent(parentThought?.id ? parentThought : {
                id: fetchedThought.parentId,
            }, user, navigation.replace);
        } else if (previousView && (previousView === 'Areas' || previousView === 'Notifications')) {
            if (previousView === 'Areas') {
                navigation.goBack();
            } else if (previousView === 'Notifications') {
                navigation.navigate('Notifications');
            }
        } else {
            navigation.navigate('Map', {
                shouldShowPreview: false,
            });
        }
    }, [fetchedThought, parentThought, previousView, user, navigation]);

    const handleGoToParent = useCallback(() => {
        if (!parentThought?.id) {
            return;
        }

        // When this screen was pushed from the parent's own thread view, the parent is the screen
        // directly below — popping to it keeps the stack from growing on every up-and-down walk.
        if (previousView === 'ViewThought' && navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        // Otherwise (a deep link, a notification) there is no parent below to return to, so it is
        // pushed. Unlike the back button's `replace`, this leaves the reply on the stack because
        // the user asked to look up, not to leave.
        navToViewContent(parentThought, user, navigation.push, 'ViewThought');
    }, [parentThought, previousView, user, navigation]);

    const handleGoToViewUser = useCallback((userId) => {
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }, [navigation]);

    const handleGoToContent = useCallback((content) => {
        if (!content?.id) {
            return;
        }
        // `push`, not `replace`: a thread is walked one level at a time, so the parent has to
        // stay on the stack for the back gesture to return to it instead of exiting to the feed.
        navToViewContent(content, user, navigation.push, 'ViewThought');
    }, [user, navigation]);

    const handleUpdateThoughtReaction = useCallback((thoughtId, data, contentUserId) => {
        if (thoughtId === thought.id) {
            navigation.setParams({
                thought: {
                    ...thought,
                    reaction: {
                        ...thought.reaction,
                        ...data,
                    },
                },
            });
        } else {
            // A reply was reacted to. Keep its reaction in local state so the control stays
            // toggled if this screen re-renders before the next details fetch.
            setReplies((prevReplies) => prevReplies.map((reply) => (reply.id === thoughtId
                ? {
                    ...reply,
                    reaction: {
                        ...reply.reaction,
                        ...data,
                    },
                }
                : reply)));
        }

        return createOrUpdateThoughtReaction(
            thoughtId,
            data,
            contentUserId || thought.fromUserId,
            user.details.userName,
        );
    }, [thought, navigation, createOrUpdateThoughtReaction, user.details.userName]);

    const handleThoughtOptionSelect = useCallback((type: IContentSelectionType, selectedThought: any) => {
        const requestArgs: any = getReactionUpdateArgs(type);
        handleUpdateThoughtReaction(selectedThought.id, requestArgs, selectedThought.fromUserId);
    }, [handleUpdateThoughtReaction]);

    const handleToggleThoughtOptions = useCallback((selectedThought: any) => {
        const thoughtForOptions = selectedThought || {};

        SheetManager.show('content-options-sheet', {
            payload: {
                contentType: 'thought',
                translate,
                themeForms,
                onSelect: (type: IContentSelectionType) => handleThoughtOptionSelect(type, thoughtForOptions),
            },
        });
    }, [translate, themeForms, handleThoughtOptionSelect]);

    const handleDeleteConfirm = useCallback(() => {
        setIsDeleting(true);
        if (checkIsMyContent(thought, user)) {
            deleteThought({ ids: [thought.id] })
                .then(() => {
                    setIsDeleting(false);
                    setIsDeleteDialogVisible(false);
                    const isAreasEnabled = getConfig().featureFlags?.[FeatureFlags.ENABLE_AREAS] === true;
                    if (isAreasEnabled) {
                        navigation.navigate('Areas');
                    } else {
                        navigation.navigate('ViewUser', {
                            userInView: { id: user.details.id },
                        });
                    }
                })
                .catch((err) => {
                    console.log('Error deleting thought', err);
                    setIsDeleting(false);
                    setIsDeleteDialogVisible(false);
                });
        }
    }, [thought, user, deleteThought, navigation]);

    const handleSubmitReply = useCallback(() => {
        if (isFormDisabled) {
            return;
        }

        const hashTags = inputMessage.match(/#[a-z0-9_]+/g) || [];
        const parentId = thought.id;
        const hashTagsString = [
            ...new Set(hashTags.map((t) => t.replace(/#/g, ''))),
        ].join(',');
        const isDraft = false;
        const isPublic = false;

        const createArgs: any = {
            parentId,
            fromUserId: user.details.id,
            isPublic,
            message: inputMessage,
            hashTags: hashTagsString,
            isDraft,
        };

        ReactNativeHapticFeedback.trigger(HAPTIC_FEEDBACK_TYPE, hapticFeedbackOptions);
        setIsSubmitting(true);

        createThought(createArgs)
            .then((newReply) => {
                // The create response has no reaction columns; seeding them keeps the new
                // reply's like control interactive without waiting for a details refetch.
                setReplies((prev) => [{ likeCount: 0, replyCount: 0, ...newReply }, ...prev]);

                logEvent(getAnalytics(), 'thought_reply_create', {
                    parentId,
                    fromUserId: user.details.id,
                    isPublic,
                    message: inputMessage,
                    hashTags: hashTagsString,
                    isDraft,
                }).catch((err) => console.log(err));
            })
            .catch((error: any) => {
                if (error.statusCode === 400 || error.statusCode === 401 || error.statusCode === 404) {
                    console.log(`${error.message}${error.parameters ? '(' + error.parameters.toString() + ')' : ''}`);
                } else if (error.statusCode >= 500) {
                    console.log(translate('forms.editThought.backendErrorMessage'));
                }
            })
            .finally(() => {
                setInputMessage('');
                if (replyInputRef.current && Platform.OS === 'android') {
                    replyInputRef.current?.clear();
                }
                setIsSubmitting(false);
                Keyboard.dismiss();
                scrollViewRef.current?.scrollToEnd?.({ animated: true });
            });
    }, [isFormDisabled, inputMessage, thought.id, user.details.id, createThought, translate]);

    const getReplyUserName = useCallback((reply) => {
        return checkIsMyContent(reply, user) ? user.details.userName : reply.fromUserName;
    }, [user]);

    const getReplyUserMedia = useCallback((reply) => {
        return checkIsMyContent(reply, user) ? user.details.media : reply.fromUserMedia;
    }, [user]);

    const renderSendIcon = useCallback(() => (
        <SendIcon
            disabled={isFormDisabled}
            colors={{ active: theme.colors.primary3, inactive: theme.colors.textGray }}
        />
    ), [isFormDisabled, theme.colors.primary3, theme.colors.textGray]);

    return (
        <>
            <BaseStatusBar therrThemeName={user.settings?.mobileThemeName} />
            <SafeAreaView edges={[]} style={theme.styles.safeAreaView}>
                <KeyboardAwareScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={scrollViewRef}
                    style={[theme.styles.bodyFlex, themeAccentLayout.styles.bodyView]}
                    contentContainerStyle={[theme.styles.bodyScroll, themeAccentLayout.styles.bodyViewScroll]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[themeAccentLayout.styles.container, themeThought.styles.inspectThoughtContainer, localStyles.contentContainer]}>
                        {/* Thread context: only rendered when this post is a reply */}
                        {
                            !!parentThought?.id &&
                                <ParentThoughtBanner
                                    isDarkMode={isDarkMode}
                                    onPress={handleGoToParent}
                                    parentThought={parentThought}
                                    theme={theme}
                                    themeViewContent={themeThought}
                                    translate={translate}
                                />
                        }

                        {/* Main thought */}
                        <ThoughtDisplay
                            translate={translate}
                            toggleThoughtOptions={() => handleToggleThoughtOptions(thoughtInView)}
                            hashtags={hashtags}
                            isDarkMode={isDarkMode}
                            isExpanded={true}
                            isRepliable={true}
                            inspectThought={() => null}
                            thought={thoughtInView}
                            goToViewUser={handleGoToViewUser}
                            updateThoughtReaction={handleUpdateThoughtReaction}
                            user={user}
                            contentUserDetails={{
                                userName: thoughtUserName || thoughtInView.fromUserId,
                                isSuperUser: thoughtInView.fromUserIsSuperUser,
                            }}
                            theme={theme}
                            themeForms={themeForms}
                            themeViewContent={themeThought}
                        />

                        {/* Replies section */}
                        {replies.length > 0 && (
                            <>
                                <Divider style={themeThought.styles.repliesDivider} />
                                <PaperText
                                    variant="titleSmall"
                                    style={themeThought.styles.repliesHeader}
                                >
                                    {`${replies.length} ${replies.length === 1
                                        ? translate('pages.viewThought.reply')
                                        : translate('pages.viewThought.replies')}`}
                                </PaperText>
                            </>
                        )}

                        {replies.map((reply) => {
                            const replyHashtags = reply.hashTags ? reply.hashTags.split(',') : [];
                            return (
                                <ThoughtDisplay
                                    key={reply.id}
                                    translate={translate}
                                    toggleThoughtOptions={() => handleToggleThoughtOptions(reply)}
                                    hashtags={replyHashtags}
                                    isDarkMode={isDarkMode}
                                    isExpanded={false}
                                    inspectThought={handleGoToContent}
                                    showThreadActions={true}
                                    thought={reply}
                                    goToViewUser={handleGoToViewUser}
                                    updateThoughtReaction={handleUpdateThoughtReaction}
                                    user={user}
                                    contentUserDetails={{
                                        userName: getReplyUserName(reply),
                                        media: getReplyUserMedia(reply),
                                        isSuperUser: reply.fromUserIsSuperUser,
                                    }}
                                    theme={theme}
                                    themeForms={themeForms}
                                    themeViewContent={themeThought}
                                />
                            );
                        })}
                    </View>
                </KeyboardAwareScrollView>

                {/*
                  * Sticky reply input + footer.
                  *
                  * Android targets API 36, where the window is edge-to-edge and no longer resizes
                  * for the keyboard, so a bottom-anchored composer is simply covered by it. The
                  * whole bar is translated by the keyboard height instead, which keeps the text
                  * the user is typing on screen on both platforms.
                  */}
                <KeyboardStickyView>
                    <View style={[themeThought.styles.replyInputContainer]}>
                        <PaperTextInput
                            ref={replyInputRef}
                            mode="outlined"
                            placeholder={translate('forms.editThought.labels.messageReply')}
                            value={inputMessage}
                            onChangeText={setInputMessage}
                            maxLength={255}
                            dense
                            // A reply is a paragraph, not a search term: the return key inserts a
                            // newline (so `onSubmitEditing` never fires here) and sending is the
                            // send icon's job.
                            multiline
                            style={localStyles.replyInput}
                            contentStyle={localStyles.replyInputContent}
                            outlineStyle={localStyles.replyInputOutline}
                            outlineColor={isDarkMode ? theme.colors.accentDivider : theme.colors.tertiary}
                            activeOutlineColor={theme.colors.primary3}
                            textColor={isDarkMode ? theme.colors.accentTextWhite : theme.colors.tertiary}
                            placeholderTextColor={isDarkMode ? theme.colorVariations?.accentTextWhiteFade : theme.colors.textGray}
                            right={
                                <PaperTextInput.Icon
                                    icon={renderSendIcon}
                                    onPress={handleSubmitReply}
                                    disabled={isFormDisabled}
                                />
                            }
                        />
                    </View>

                    {/*
                      * Footer. Hidden while the keyboard is up so the composer sits directly on
                      * top of it — otherwise these buttons would ride up between the two and eat
                      * a row of the thread. Both navigation options remain reachable: dismissing
                      * the keyboard brings them straight back.
                      */}
                    {!isKeyboardVisible && (
                        <View style={themeThought.styles.footer}>
                            <PaperButton
                                mode="outlined"
                                onPress={handleGoBack}
                                icon="arrow-left"
                                textColor={brandColor}
                                style={localStyles.footerButton}
                            >
                                {parentThought?.id
                                    ? translate('pages.viewThought.backToParent')
                                    : translate('forms.editThought.buttons.back')}
                            </PaperButton>
                            {isMyContent && (
                                <PaperButton
                                    mode="contained"
                                    onPress={() => setIsDeleteDialogVisible(true)}
                                    icon="trash-can-outline"
                                    buttonColor={theme.colors.accentRed}
                                    textColor={theme.colors.brandingWhite}
                                    style={localStyles.footerButton}
                                    disabled={isDeleting}
                                >
                                    {translate('forms.editThought.buttons.delete')}
                                </PaperButton>
                            )}
                        </View>
                    )}
                </KeyboardStickyView>
            </SafeAreaView>

            {/* Delete confirmation modal */}
            <ConfirmModal
                isVisible={isDeleteDialogVisible}
                onCancel={() => setIsDeleteDialogVisible(false)}
                onConfirm={handleDeleteConfirm}
                text={translate('forms.editThought.deleteConfirmation')}
                textConfirm={translate('forms.editThought.buttons.confirm')}
                textCancel={translate('forms.editThought.buttons.cancel')}
                translate={translate}
                theme={theme}
                themeModal={themeConfirmModal}
                themeButtons={themeButtons}
            />
        </>
    );
};

export default connect(mapStateToProps, mapDispatchToProps)(ViewThought);
