import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IOpenPact } from 'therr-react/types';
import { Button } from '../BaseButton';
import { FeedPactPitch } from '../../utilities/feedOpenPacts';

interface IFeedOpenPactCardProps {
    pact: IOpenPact;
    pitch: FeedPactPitch;
    /** The server's seat ceiling, or null from a server that predates it — see OpenPacts. */
    maxMembers: number | null;
    /** A request for this card (or another) is in flight; every card's button waits on it. */
    isBusy: boolean;
    isPending: boolean;
    onAskToJoin: (pact: IOpenPact) => void;
    onCancelRequest: (pact: IOpenPact) => void;
    onSeeAll: () => void;
    translate: (key: string, params?: any) => string;
    themeHabits: any;
    themeButtons: any;
}

/**
 * One open pact between posts in the feed: why it is worth joining, what it is, and one tap to ask.
 * Asking only sends the creator a request — they approve each one — so the button can be a plain
 * "Ask to join" with no confirmation step. The same request flow as the OpenPacts screen, which the
 * "See all" row opens for anyone who wants more than the few cards the feed shows.
 */
const FeedOpenPactCard = ({
    pact,
    pitch,
    maxMembers,
    isBusy,
    isPending,
    onAskToJoin,
    onCancelRequest,
    onSeeAll,
    translate,
    themeHabits,
    themeButtons,
}: IFeedOpenPactCardProps) => {
    const creatorName = pact.creatorUserName || translate('pages.pacts.partnerFallback');

    return (
        <View style={themeHabits.styles.streakWidgetContainer}>
            <Text style={themeHabits.styles.feedPactEyebrow}>
                {translate(`pages.habits.feed.openPact.eyebrow.${pitch}`)}
            </Text>
            <View style={themeHabits.styles.feedPactHeaderRow}>
                <Text style={themeHabits.styles.habitCardEmoji}>
                    {pact.habitGoalEmoji || '🤝'}
                </Text>
                <View style={themeHabits.styles.habitNotificationPrefsLabelContainer}>
                    <Text style={themeHabits.styles.streakWidgetTitle} numberOfLines={2}>
                        {pact.habitGoalName}
                    </Text>
                    <Text style={themeHabits.styles.habitNotificationPrefsHint}>
                        {translate(maxMembers
                            ? 'pages.pacts.openPact.rowDetail'
                            : 'pages.pacts.openPact.rowDetailNoSeats', {
                            name: creatorName,
                            count: pact.memberCount,
                            seats: maxMembers,
                            days: pact.durationDays,
                        })}
                    </Text>
                </View>
            </View>
            <Text style={themeHabits.styles.feedPactPitch}>
                {translate(`pages.habits.feed.openPact.pitch.${pitch}`, { name: creatorName })}
            </Text>
            {pact.hasPendingJoinRequest ? (
                <Button
                    buttonStyle={[themeButtons.styles.btnClear, { marginTop: 8 }]}
                    titleStyle={themeButtons.styles.btnTitleBlack}
                    title={translate('pages.habits.feed.openPact.requestedCancel')}
                    accessibilityLabel={translate('pages.pacts.openPact.cancelRequestFor', { name: creatorName })}
                    onPress={() => onCancelRequest(pact)}
                    loading={isPending}
                    disabled={isBusy}
                />
            ) : (
                <Button
                    buttonStyle={[themeButtons.styles.btnLargeWithText, { marginTop: 12 }]}
                    titleStyle={themeButtons.styles.btnLargeTitle}
                    title={translate('pages.pacts.openPact.askToJoin')}
                    accessibilityLabel={translate('pages.pacts.openPact.askToJoinFor', { name: creatorName })}
                    onPress={() => onAskToJoin(pact)}
                    loading={isPending}
                    disabled={isBusy}
                />
            )}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('pages.habits.feed.openPact.seeAll')}
                onPress={onSeeAll}
                style={({ pressed }) => [
                    themeHabits.styles.pactLinkRow,
                    pressed && themeHabits.styles.pactPressedSurface,
                ]}
            >
                <Text style={themeHabits.styles.pactLinkText}>
                    {translate('pages.habits.feed.openPact.seeAll')}
                </Text>
                <MaterialIcon
                    name="chevron-right"
                    size={24}
                    color={themeHabits.colors.primary3}
                />
            </Pressable>
        </View>
    );
};

export default FeedOpenPactCard;
