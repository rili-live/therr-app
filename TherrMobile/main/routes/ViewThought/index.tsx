import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Keyboard,
    Platform,
    SafeAreaView,
    StyleSheet,
    View,
} from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button as PaperButton, Divider, Text as PaperText, TextInput as PaperTextInput } from 'react-native-paper';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { IContentState, IUserState } from 'therr-react/types';
import { ContentActions } from 'therr-react/redux/actions';
import UsersActions from '../../redux/actions/UsersActions';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
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

const localStyles = StyleSheet.create({
    contentContainer: {
        paddingHorizontal: 10,
    },
    replyInput: {
        flex: 1,
        fontSize: 16,
        backgroundColor: 'transparent',
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
    const isFormDisabled = !inputMessage || isSubmitting;
    const brandColor = isDarkMode ? theme.colors.textWhite : theme.colors.brandingBlueGreen;

    // Fetch thought details and set up nav listener
    useEffect(() => {
        getThoughtDetails(thought.id, {
            withUser: true,
            withReplies: true,
        }).then((response) => {
            setFetchedThought(response?.thought || {});
            setReplies(
                response?.thought?.replies?.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ) || []
            );
        }).catch(() => {
            navigation.goBack();
        });

        navigation.setOptions({
            title: translate('pages.viewThought.headerTitle'),
        });

        const unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // Placeholder for future nav bar color changes
        });

        return () => {
            unsubscribeNavListener();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handlers
    const handleGoBack = useCallback(() => {
        if (fetchedThought?.parentId) {
            navToViewContent({
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
    }, [fetchedThought, previousView, user, navigation]);

    const handleGoToViewUser = useCallback((userId) => {
        navigation.navigate('ViewUser', {
            userInView: {
                id: userId,
            },
        });
    }, [navigation]);

    const handleGoToContent = useCallback((content) => {
        navToViewContent(content, user, navigation.replace);
    }, [user, navigation]);

    const handleUpdateThoughtReaction = useCallback((thoughtId, data) => {
        navigation.setParams({
            thought: {
                ...thought,
                reaction: {
                    ...thought.reaction,
                    ...data,
                },
            },
        });
        return createOrUpdateThoughtReaction(thoughtId, data, thought.fromUserId, user.details.userName);
    }, [thought, navigation, createOrUpdateThoughtReaction, user.details.userName]);

    const handleThoughtOptionSelect = useCallback((type: IContentSelectionType, selectedThought: any) => {
        const requestArgs: any = getReactionUpdateArgs(type);
        handleUpdateThoughtReaction(selectedThought.id, requestArgs);
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
                    navigation.navigate('Areas');
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
                setReplies((prev) => [newReply, ...prev]);

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
            <SafeAreaView style={theme.styles.safeAreaView}>
                <KeyboardAwareScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={scrollViewRef}
                    style={[theme.styles.bodyFlex, themeAccentLayout.styles.bodyView]}
                    contentContainerStyle={[theme.styles.bodyScroll, themeAccentLayout.styles.bodyViewScroll]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[themeAccentLayout.styles.container, themeThought.styles.inspectThoughtContainer, localStyles.contentContainer]}>
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

                {/* Sticky reply input */}
                <View style={[themeThought.styles.replyInputContainer]}>
                    <PaperTextInput
                        ref={replyInputRef}
                        mode="outlined"
                        placeholder={translate('forms.editThought.labels.messageReply')}
                        value={inputMessage}
                        onChangeText={setInputMessage}
                        onSubmitEditing={handleSubmitReply}
                        maxLength={255}
                        dense
                        style={localStyles.replyInput}
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

                {/* Footer */}
                <View style={themeThought.styles.footer}>
                    <PaperButton
                        mode="outlined"
                        onPress={handleGoBack}
                        icon="arrow-left"
                        textColor={brandColor}
                        style={localStyles.footerButton}
                    >
                        {translate('forms.editThought.buttons.back')}
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
