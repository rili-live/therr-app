import React, {
    useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
    ActivityIndicator,
    AppState,
    FlatList,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useFocusEffect } from '@react-navigation/native';
import { connect } from 'react-redux';
import Toast from 'react-native-toast-message';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { PactsService } from 'therr-react/services';
import {
    IHabitsState, IPact, IPactChatItem, IPactChatUser, IUserState,
} from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildMessageStyles } from '../../styles/user-content/messages';
import { buildStyles as buildChatStyles } from '../../styles/habits/pactChat';
import { buildStyles as buildModalStyles } from '../../styles/modal/confirmModal';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';
import translator from '../../utilities/translator';
import { getApiErrorMessage } from '../../utilities/apiErrorMessage';
import { logAppEvent } from '../../utilities/analyticsEvents';
import BaseStatusBar from '../../components/BaseStatusBar';
import BaseInput from '../../components/Input';
import { Button } from '../../components/BaseButton';
import TherrIcon from '../../components/TherrIcon';
import ConfirmModal from '../../components/Modals/ConfirmModal';
import {
    DEFAULT_REACTION_OPTIONS,
    IChatListItem,
    IPendingChatItem,
    PACT_CHAT_MAX_MESSAGE_LENGTH,
    PACT_CHAT_POLL_INTERVAL_MS,
    QUICK_REPLY_KEYS,
    applyMyReaction,
    confirmPendingItem,
    formatChatTime,
    generateClientMessageId,
    getAuthorName,
    getMyReaction,
    getNewestConfirmedAt,
    getNextReaction,
    getOldestConfirmedAt,
    isFirstOfRun,
    isPendingItem,
    mergeChatItems,
    summarizeReactions,
} from './pactChatState';

/**
 * One pact's chat: members' messages with their completed check-ins inline, emoji reactions,
 * quick replies and a per-pact mute. See docs/niche-sub-apps/habits/HABITS_PACT_CHAT_DESIGN.md.
 *
 * Reached from the pact screen's chat card and from a `pactMessage` push (Layout routes the tap
 * here). REST plus polling — every PACT_CHAT_POLL_INTERVAL_MS while the screen has focus, and on
 * return to the foreground — so a partner who is reading never also gets the push: the server
 * skips a push once the recipient's read watermark has passed the message.
 *
 * Screen-local state rather than redux: nothing else renders a thread. The unread count the pact
 * list shows comes back on the next pact fetch.
 */

interface IPactChatProps {
    user: IUserState;
    habits?: IHabitsState;
    navigation: any;
    // `any` so the connected component stays assignable to React Navigation's ScreenComponentType.
    // Params: `pactId` (required), `source?` (analytics: pact_detail | pact_card | push).
    route: any;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    habits: state.habits,
});

/** The pact's habit name for the header, from whichever list already holds it. */
const findHabitName = (habits: IHabitsState | undefined, pactId: string | undefined): string | undefined => {
    if (!habits || !pactId) return undefined;
    const pact = [...(habits.pacts || []), ...(habits.activePacts || [])].find((candidate: IPact) => candidate.id === pactId);
    return pact?.habitGoalName || undefined;
};

const PAGE_SIZE = 30;

/**
 * Same approach as the DM thread (routes/DirectMessage): pad by the keyboard height rather than
 * using KeyboardAvoidingView, which comes out short by the custom header's height on this stack.
 */
const KeyboardInsetView = ({ children, style }: { children: React.ReactNode; style?: any }) => {
    const keyboardHeight = useKeyboardState((state) => state.height);
    const paddingBottom = Math.max(keyboardHeight - bottomSafeAreaInset, 0);
    return <View style={[style, { paddingBottom }]}>{children}</View>;
};

export const PactChat: React.FC<IPactChatProps> = ({
    user, habits, navigation, route,
}) => {
    const themeName = user.settings?.mobileThemeName;
    const theme = useMemo(() => buildStyles(themeName), [themeName]);
    const themeForms = useMemo(() => buildFormsStyles(themeName), [themeName]);
    const themeMessage = useMemo(() => buildMessageStyles(themeName), [themeName]);
    const themeChat = useMemo(() => buildChatStyles(themeName), [themeName]);
    const themeModal = useMemo(() => buildModalStyles(themeName), [themeName]);
    const themeButtons = useMemo(() => buildButtonStyles(themeName), [themeName]);
    const locale = user.settings?.locale || 'en-us';
    const translate = useCallback((key: string, params?: any) => translator(locale, key, params), [locale]);
    const chatStyles = themeChat.styles;
    const messageStyles = themeMessage.styles;

    const pactId: string | undefined = typeof route?.params?.pactId === 'string' ? route.params.pactId : undefined;
    const habitName = findHabitName(habits, pactId);
    const source: string = route?.params?.source || 'pact_detail';
    const viewerUserId = user.details?.id || '';

    const [items, setItems] = useState<IChatListItem[]>([]);
    const [users, setUsers] = useState<Record<string, IPactChatUser>>({});
    const [canPost, setCanPost] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [reactionOptions, setReactionOptions] = useState<string[]>(DEFAULT_REACTION_OPTIONS);
    const [hasMore, setHasMore] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [draft, setDraft] = useState('');
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [reportTarget, setReportTarget] = useState<IPactChatItem | null>(null);
    const [isReporting, setIsReporting] = useState(false);

    const isMounted = useRef(true);
    const itemsRef = useRef<IChatListItem[]>([]);
    const isPolling = useRef(false);

    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const markRead = useCallback(() => {
        if (!pactId) return;
        PactsService.markChatRead(pactId).catch(() => undefined);
    }, [pactId]);

    const applyPage = useCallback((data: any) => {
        if (data?.users && typeof data.users === 'object') {
            setUsers((prev) => ({ ...prev, ...data.users }));
        }
        if (typeof data?.canPost === 'boolean') setCanPost(data.canPost);
        if (typeof data?.isMuted === 'boolean') setIsMuted(data.isMuted);
        if (Array.isArray(data?.reactionOptions) && data.reactionOptions.length) {
            setReactionOptions(data.reactionOptions);
        }
    }, []);

    const loadInitial = useCallback(() => {
        if (!pactId) {
            setLoadError(true);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        PactsService.getChat(pactId, { limit: PAGE_SIZE })
            .then((response: any) => {
                if (!isMounted.current) return;
                const data = response?.data;
                if (!Array.isArray(data?.items)) {
                    setLoadError(true);
                    return;
                }
                applyPage(data);
                setItems((prev) => mergeChatItems(prev.filter(isPendingItem), data.items));
                setHasMore(!!data.hasMore);
                setLoadError(false);
                markRead();
            })
            .catch(() => {
                if (isMounted.current) setLoadError(true);
            })
            .finally(() => {
                if (isMounted.current) setIsLoading(false);
            });
    }, [pactId, applyPage, markRead]);

    const pollNew = useCallback(() => {
        const after = getNewestConfirmedAt(itemsRef.current);
        if (!pactId || !after || isPolling.current) return;
        isPolling.current = true;
        PactsService.getChat(pactId, { after, limit: 50 })
            .then((response: any) => {
                if (!isMounted.current) return;
                const data = response?.data;
                if (!Array.isArray(data?.items) || !data.items.length) return;
                applyPage(data);
                setItems((prev) => mergeChatItems(prev, data.items));
                if (data.items.some((item: IPactChatItem) => item.userId !== viewerUserId)) {
                    markRead();
                }
            })
            .catch(() => undefined)
            .finally(() => { isPolling.current = false; });
    }, [pactId, applyPage, markRead, viewerUserId]);

    const loadOlder = useCallback(() => {
        const before = getOldestConfirmedAt(itemsRef.current);
        if (!pactId || !before || !hasMore || isLoadingOlder) return;
        setIsLoadingOlder(true);
        PactsService.getChat(pactId, { before, limit: PAGE_SIZE })
            .then((response: any) => {
                if (!isMounted.current) return;
                const data = response?.data;
                if (!Array.isArray(data?.items)) return;
                applyPage(data);
                setItems((prev) => mergeChatItems(prev, data.items));
                setHasMore(!!data.hasMore);
            })
            .catch(() => undefined)
            .finally(() => {
                if (isMounted.current) setIsLoadingOlder(false);
            });
    }, [pactId, hasMore, isLoadingOlder, applyPage]);

    // Follows the pact into redux: a push can open this screen before the pact list has loaded.
    useEffect(() => {
        navigation.setOptions({
            title: habitName
                ? translate('pages.pactChat.headerTitle', { habitName })
                : translate('pages.pactChat.headerTitleFallback'),
        });
    }, [navigation, habitName, translate]);

    useEffect(() => {
        logAppEvent('pact_chat_open', { userId: viewerUserId, source });
        loadInitial();
        // Mount only: one open, one initial load. Refreshes come from polling below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Poll only while focused, and catch up on return to the foreground.
    useFocusEffect(
        useCallback(() => {
            const interval = setInterval(pollNew, PACT_CHAT_POLL_INTERVAL_MS);
            const subscription = AppState.addEventListener('change', (state) => {
                if (state === 'active') pollNew();
            });
            return () => {
                clearInterval(interval);
                subscription.remove();
            };
        }, [pollNew]),
    );

    const sendText = useCallback((rawText: string, { isQuickReply = false }: { isQuickReply?: boolean } = {}, retryOf?: IPendingChatItem) => {
        const text = rawText.trim();
        if (!pactId || !text || !canPost) return;

        const clientMessageId = retryOf?.clientMessageId || generateClientMessageId();
        const pending: IPendingChatItem = {
            id: retryOf?.id || `pending-${clientMessageId}`,
            kind: 'message',
            pactId,
            userId: viewerUserId,
            createdAt: retryOf?.createdAt || new Date().toISOString(),
            text,
            reactions: [],
            clientMessageId,
            sendState: 'sending',
        };
        setItems((prev) => mergeChatItems(prev, [pending]));
        if (!retryOf) setDraft('');

        PactsService.sendChatMessage(pactId, { text, clientMessageId })
            .then((response: any) => {
                if (!isMounted.current) return;
                const confirmed = response?.data?.item;
                if (!confirmed?.id) throw new Error('no item');
                setItems((prev) => confirmPendingItem(prev, clientMessageId, confirmed));
                logAppEvent('pact_message_send', { userId: viewerUserId, isQuickReply, isRetry: !!retryOf });
            })
            .catch((error: any) => {
                if (!isMounted.current) return;
                setItems((prev) => prev.map((item) => (
                    isPendingItem(item) && item.clientMessageId === clientMessageId
                        ? { ...item, sendState: 'failed' }
                        : item
                )));
                const apiMessage = getApiErrorMessage(error);
                if (apiMessage) {
                    Toast.show({ type: 'error', text1: translate('pages.pactChat.errorTitle'), text2: apiMessage });
                }
            });
    }, [pactId, canPost, viewerUserId, translate]);

    const handleReact = useCallback((item: IPactChatItem, tapped: string) => {
        if (!pactId || !canPost || isPendingItem(item)) return;
        const next = getNextReaction(getMyReaction(item.reactions, viewerUserId), tapped);
        const previous = item.reactions;
        setSelectedItemId(null);
        setItems((prev) => prev.map((candidate) => (candidate.id === item.id
            ? { ...candidate, reactions: applyMyReaction(candidate.reactions, viewerUserId, next) }
            : candidate)));

        PactsService.setChatReaction(pactId, { targetId: item.id, targetKind: item.kind, emoji: next })
            .then((response: any) => {
                const reactions = response?.data?.reactions;
                if (!isMounted.current || !Array.isArray(reactions)) return;
                setItems((prev) => prev.map((candidate) => (candidate.id === item.id ? { ...candidate, reactions } : candidate)));
                if (next) logAppEvent('pact_chat_react', { userId: viewerUserId, targetKind: item.kind, emoji: next });
            })
            .catch(() => {
                if (!isMounted.current) return;
                setItems((prev) => prev.map((candidate) => (candidate.id === item.id ? { ...candidate, reactions: previous } : candidate)));
                Toast.show({ type: 'error', text1: translate('pages.pactChat.reactionFailed') });
            });
    }, [pactId, canPost, viewerUserId, translate]);

    const handleConfirmReport = useCallback(() => {
        const target = reportTarget;
        if (!pactId || !target) return;
        setIsReporting(true);
        PactsService.reportChatMessage(pactId, target.id)
            .then(() => {
                if (!isMounted.current) return;
                setItems((prev) => prev.filter((item) => item.id !== target.id));
                Toast.show({ type: 'success', text1: translate('pages.pactChat.reportedToast') });
            })
            .catch((error: any) => {
                Toast.show({
                    type: 'error',
                    text1: translate('pages.pactChat.errorTitle'),
                    text2: getApiErrorMessage(error) || undefined,
                });
            })
            .finally(() => {
                if (!isMounted.current) return;
                setIsReporting(false);
                setReportTarget(null);
            });
    }, [pactId, reportTarget, translate]);

    const handleToggleMute = useCallback(() => {
        if (!pactId) return;
        const next = !isMuted;
        setIsMuted(next);
        PactsService.setChatMute(pactId, next)
            .then(() => {
                Toast.show({
                    type: 'success',
                    text1: translate(next ? 'pages.pactChat.mutedToast' : 'pages.pactChat.unmutedToast'),
                    visibilityTime: 2000,
                });
            })
            .catch(() => {
                if (isMounted.current) setIsMuted(!next);
                Toast.show({ type: 'error', text1: translate('pages.pactChat.errorTitle') });
            });
    }, [pactId, isMuted, translate]);

    const goToProfile = useCallback((userId: string) => {
        setSelectedItemId(null);
        // Blocking lives on the profile; the chat filters a blocked author on its next read.
        navigation.navigate('ViewUser', { userInView: { id: userId } });
    }, [navigation]);

    const renderReactions = (item: IChatListItem, alignStyle: any) => {
        const summaries = summarizeReactions(item.reactions, viewerUserId);
        if (!summaries.length) return null;
        return (
            <View style={[chatStyles.reactionRow, alignStyle]}>
                {summaries.map((summary) => (
                    <Pressable
                        key={summary.emoji}
                        accessibilityRole="button"
                        accessibilityLabel={`${summary.emoji} ${summary.count}`}
                        disabled={!canPost || isPendingItem(item)}
                        onPress={() => handleReact(item, summary.emoji)}
                        style={[chatStyles.reactionChip, summary.isMine && chatStyles.reactionChipMine]}
                    >
                        <Text style={chatStyles.reactionChipText}>
                            {summary.count > 1 ? `${summary.emoji} ${summary.count}` : summary.emoji}
                        </Text>
                    </Pressable>
                ))}
            </View>
        );
    };

    const renderPicker = (item: IChatListItem) => {
        if (selectedItemId !== item.id || isPendingItem(item)) return null;
        const mine = getMyReaction(item.reactions, viewerUserId);
        const isOthersMessage = item.kind === 'message' && item.userId !== viewerUserId;
        return (
            <View style={chatStyles.pickerRow}>
                {canPost && reactionOptions.map((emoji) => (
                    <Pressable
                        key={emoji}
                        accessibilityRole="button"
                        accessibilityLabel={emoji}
                        onPress={() => handleReact(item, emoji)}
                        style={mine === emoji ? chatStyles.pickerEmojiSelected : undefined}
                    >
                        <Text style={chatStyles.pickerEmoji}>{emoji}</Text>
                    </Pressable>
                ))}
                {item.userId !== viewerUserId && (
                    <Pressable accessibilityRole="button" onPress={() => goToProfile(item.userId)}>
                        <Text style={chatStyles.pickerAction}>{translate('pages.pactChat.viewProfile')}</Text>
                    </Pressable>
                )}
                {isOthersMessage && (
                    <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                            setSelectedItemId(null);
                            setReportTarget(item);
                        }}
                    >
                        <Text style={chatStyles.pickerAction}>{translate('pages.pactChat.report')}</Text>
                    </Pressable>
                )}
            </View>
        );
    };

    const renderItem = ({ item, index }: { item: IChatListItem; index: number }) => {
        const isMine = item.userId === viewerUserId;
        const authorName = isMine
            ? translate('pages.pactChat.you')
            : getAuthorName(users, item.userId, translate('pages.pactChat.partnerFallback'));
        const toggleSelected = () => setSelectedItemId((current) => (current === item.id ? null : item.id));

        if (item.kind === 'checkin') {
            const habitLabel = [item.checkin?.habitGoalEmoji, item.checkin?.habitGoalName].filter(Boolean).join(' ');
            return (
                <View>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityHint={translate('pages.pactChat.reactHint')}
                        onLongPress={toggleSelected}
                        style={chatStyles.checkinCard}
                    >
                        <Text style={chatStyles.checkinTitle}>
                            {translate('pages.pactChat.checkedIn', { name: authorName })}
                            {habitLabel ? ` · ${habitLabel}` : ''}
                        </Text>
                        {!!item.checkin?.notes && (
                            <Text style={chatStyles.checkinNotes}>{item.checkin.notes}</Text>
                        )}
                        <Text style={chatStyles.checkinMeta}>
                            {item.checkin?.hasProof ? `${translate('pages.pactChat.withPhoto')} · ` : ''}
                            {formatChatTime(item.createdAt, locale)}
                        </Text>
                    </Pressable>
                    {renderReactions(item, chatStyles.reactionRowCenter)}
                    {renderPicker(item)}
                </View>
            );
        }

        const pending = isPendingItem(item) ? item : undefined;
        return (
            <View>
                {isFirstOfRun(items, index) && (
                    <Pressable
                        disabled={isMine}
                        onPress={() => goToProfile(item.userId)}
                        style={isMine ? chatStyles.authorNameRight : undefined}
                    >
                        <Text style={[chatStyles.authorName, isMine && chatStyles.authorNameRight]}>{authorName}</Text>
                    </Pressable>
                )}
                <Pressable
                    accessibilityHint={translate('pages.pactChat.reactHint')}
                    onLongPress={toggleSelected}
                    style={[
                        isMine ? messageStyles.messageContainerRight : messageStyles.messageContainerLeft,
                        pending?.sendState === 'sending' && chatStyles.pendingBubble,
                    ]}
                >
                    <Text style={isMine ? messageStyles.messageTextRight : messageStyles.messageTextLeft}>{item.text}</Text>
                    <Text style={isMine ? messageStyles.messageDateRight : messageStyles.messageDateLeft}>
                        {formatChatTime(item.createdAt, locale)}
                    </Text>
                </Pressable>
                {pending?.sendState === 'failed' && (
                    <Pressable accessibilityRole="button" onPress={() => sendText(pending.text || '', {}, pending)}>
                        <Text style={chatStyles.failedText}>{translate('pages.pactChat.sendFailed')}</Text>
                    </Pressable>
                )}
                {renderReactions(item, isMine ? chatStyles.reactionRowRight : chatStyles.reactionRowLeft)}
                {renderPicker(item)}
            </View>
        );
    };

    const renderBody = () => {
        if (isLoading && !items.length) {
            return (
                <View style={chatStyles.centered}>
                    <ActivityIndicator size="large" color={theme.colors.primary3} />
                </View>
            );
        }
        if (loadError && !items.length) {
            return (
                <View style={chatStyles.centered}>
                    <Text style={chatStyles.emptyTitle}>{translate('pages.pactChat.loadError')}</Text>
                    <Pressable accessibilityRole="button" onPress={loadInitial}>
                        <Text style={chatStyles.retryText}>{translate('pages.pactChat.retry')}</Text>
                    </Pressable>
                </View>
            );
        }
        return (
            <FlatList<IChatListItem>
                data={items}
                inverted
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                extraData={[selectedItemId, users, canPost]}
                onEndReached={loadOlder}
                onEndReachedThreshold={0.5}
                keyboardShouldPersistTaps="handled"
                ListFooterComponent={isLoadingOlder ? <ActivityIndicator color={theme.colors.primary3} /> : null}
                ListEmptyComponent={(
                    <View style={chatStyles.emptyState}>
                        <Text style={chatStyles.emptyTitle}>{translate('pages.pactChat.emptyTitle')}</Text>
                        <Text style={chatStyles.emptySubtitle}>{translate('pages.pactChat.emptySubtitle')}</Text>
                    </View>
                )}
                contentContainerStyle={!items.length ? chatStyles.emptyListContent : undefined}
            />
        );
    };

    return (
        <>
            <BaseStatusBar therrThemeName={themeName} />
            <SafeAreaView edges={[]} style={theme.styles.safeAreaView}>
                <KeyboardInsetView style={messageStyles.container}>
                    <View style={chatStyles.topBar}>
                        <Text style={chatStyles.topBarText} numberOfLines={1}>
                            {translate('pages.pactChat.reactHint')}
                        </Text>
                        <Pressable
                            accessibilityRole="switch"
                            accessibilityState={{ checked: isMuted }}
                            accessibilityLabel={translate(isMuted ? 'pages.pactChat.unmute' : 'pages.pactChat.mute')}
                            onPress={handleToggleMute}
                            style={chatStyles.mutePill}
                        >
                            <MaterialIcon
                                name={isMuted ? 'notifications-off' : 'notifications-none'}
                                size={16}
                                color={theme.colors.onSurface}
                            />
                            <Text style={chatStyles.mutePillText}>
                                {translate(isMuted ? 'pages.pactChat.unmute' : 'pages.pactChat.mute')}
                            </Text>
                        </Pressable>
                    </View>

                    <View style={chatStyles.listContainer}>{renderBody()}</View>

                    {canPost ? (
                        <>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={chatStyles.quickReplyRow}
                            >
                                {QUICK_REPLY_KEYS.map((key) => (
                                    <Pressable
                                        key={key}
                                        accessibilityRole="button"
                                        onPress={() => sendText(translate(key), { isQuickReply: true })}
                                        style={chatStyles.quickReplyChip}
                                    >
                                        <Text style={chatStyles.quickReplyText}>{translate(key)}</Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                            <View style={messageStyles.sendInputsContainer}>
                                <BaseInput
                                    variant="round"
                                    value={draft}
                                    onChangeText={setDraft}
                                    maxLength={PACT_CHAT_MAX_MESSAGE_LENGTH}
                                    placeholder={translate('pages.pactChat.inputPlaceholder')}
                                    onSubmitEditing={() => sendText(draft)}
                                    containerStyle={messageStyles.inputContainer}
                                    errorStyle={theme.styles.displayNone}
                                    themeForms={themeForms}
                                />
                                <Button
                                    accessibilityLabel={translate('pages.pactChat.send')}
                                    icon={<TherrIcon name="send" size={26} style={messageStyles.icon} />}
                                    buttonStyle={messageStyles.sendBtn}
                                    containerStyle={messageStyles.sendBtnContainer}
                                    onPress={() => sendText(draft)}
                                    disabled={!draft.trim()}
                                />
                            </View>
                        </>
                    ) : (!isLoading && !loadError && (
                        <View style={[chatStyles.readOnlyBanner, { paddingBottom: 12 + bottomSafeAreaInset }]}>
                            <Text style={chatStyles.readOnlyText}>{translate('pages.pactChat.readOnly')}</Text>
                        </View>
                    ))}
                </KeyboardInsetView>
            </SafeAreaView>
            <ConfirmModal
                isVisible={!!reportTarget}
                isConfirming={isReporting}
                headerText={translate('pages.pactChat.reportConfirmTitle')}
                text={translate('pages.pactChat.reportConfirmBody')}
                textConfirm={translate('pages.pactChat.report')}
                onCancel={() => setReportTarget(null)}
                onConfirm={handleConfirmReport}
                translate={translate}
                theme={theme}
                themeModal={themeModal}
                themeButtons={themeButtons}
            />
        </>
    );
};

export default connect(mapStateToProps)(PactChat);
