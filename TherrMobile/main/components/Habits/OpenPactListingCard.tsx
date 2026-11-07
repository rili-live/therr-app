import React from 'react';
import {
    ActivityIndicator, Pressable, Text, View,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IOpenPact } from 'therr-react/types';
import { getOpenPactSeats, getOpenPactSeatsLabel } from '../../utilities/openPactListing';

interface IOpenPactListingCardProps {
    pact: IOpenPact;
    /** The server's seat ceiling, or null from a server that predates it — see OpenPacts. */
    maxMembers: number | null;
    /** A request for this card (or another) is in flight; every card's action waits on it. */
    isBusy: boolean;
    /** The request in flight is this card's. */
    isPending: boolean;
    onAskToJoin: (pact: IOpenPact) => void;
    onCancelRequest: (pact: IOpenPact) => void;
    /** A short reason to join, as a pill above the title (the feed's pitch label). */
    eyebrow?: string;
    eyebrowIcon?: string;
    /** One sentence under the title saying why this pact is worth joining. */
    pitch?: string;
    /** Rendered at the bottom of the card, below the action (the feed's "See all" link). */
    footer?: React.ReactNode;
    translate: (key: string, params?: any) => string;
    themeHabits: any;
}

/**
 * One open pact someone could ask to join: what the habit is, who started it, how long it runs,
 * how many seats are left, and one action. Shared by the OpenPacts screen and the feed so the same
 * pact looks the same in both places.
 *
 * Asking only sends the creator a request — they approve each one — so the button needs no
 * confirmation step. Once asked, the card shows that as a status the creator now owns, with a quiet
 * way to take the request back, rather than a second button competing with the rest of the card.
 */
const OpenPactListingCard = ({
    pact,
    maxMembers,
    isBusy,
    isPending,
    onAskToJoin,
    onCancelRequest,
    eyebrow,
    eyebrowIcon,
    pitch,
    footer,
    translate,
    themeHabits,
}: IOpenPactListingCardProps) => {
    const { styles, colors } = themeHabits;
    const creatorName = pact.creatorUserName || translate('pages.pacts.partnerFallback');
    const seats = getOpenPactSeats(pact.memberCount, maxMembers);
    const seatsLabel = getOpenPactSeatsLabel(seats);
    const isRunning = pact.status === 'active';

    const renderSeatDots = () => {
        if (!seats.showDots || !seats.total) {
            return null;
        }

        return (
            <View style={styles.openPactSeatDots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {Array.from({ length: seats.total }, (_, index) => (
                    <View
                        key={index}
                        style={[styles.openPactSeatDot, index < seats.filled && styles.openPactSeatDotFilled]}
                    />
                ))}
            </View>
        );
    };

    const renderAction = () => {
        if (pact.hasPendingJoinRequest) {
            return (
                <View style={styles.openPactRequestedRow}>
                    <View style={styles.openPactRequestedPill}>
                        <MaterialIcon name="check-circle" size={16} color={styles.openPactRequestedText.color} />
                        <Text style={styles.openPactRequestedText} numberOfLines={1}>
                            {translate('pages.pacts.openPact.requestedStatus')}
                        </Text>
                    </View>
                    {isPending ? (
                        <ActivityIndicator color={styles.openPactEyebrowText.color} style={styles.openPactSpinner} />
                    ) : (
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translate('pages.pacts.openPact.cancelRequestFor', { name: creatorName })}
                            accessibilityState={{ disabled: isBusy }}
                            disabled={isBusy}
                            onPress={() => onCancelRequest(pact)}
                            style={({ pressed }) => [
                                styles.openPactCancelAction,
                                pressed && styles.pactPressedSurface,
                                isBusy && styles.openPactButtonDisabled,
                            ]}
                        >
                            <Text style={styles.openPactCancelActionText} numberOfLines={1}>
                                {translate('pages.pacts.openPact.cancelRequest')}
                            </Text>
                        </Pressable>
                    )}
                </View>
            );
        }

        return (
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={translate('pages.pacts.openPact.askToJoinFor', { name: creatorName })}
                accessibilityState={{ disabled: isBusy, busy: isPending }}
                disabled={isBusy}
                onPress={() => onAskToJoin(pact)}
                style={({ pressed }) => [
                    styles.pactCardInviteButton,
                    styles.pactCardInviteButtonPrimary,
                    styles.openPactAskButton,
                    pressed && styles.pactCardInviteButtonPressed,
                    isBusy && !isPending && styles.openPactButtonDisabled,
                ]}
            >
                {isPending ? (
                    <ActivityIndicator color={colors.onBrand} />
                ) : (
                    <>
                        <MaterialIcon name="person-add" size={18} color={colors.onBrand} />
                        <Text style={styles.pactCardInviteButtonPrimaryText}>
                            {translate('pages.pacts.openPact.askToJoin')}
                        </Text>
                    </>
                )}
            </Pressable>
        );
    };

    return (
        <View style={styles.pactCardContainer}>
            {!!eyebrow && (
                <View style={styles.openPactEyebrow}>
                    {!!eyebrowIcon && <MaterialIcon name={eyebrowIcon} size={14} color={styles.openPactEyebrowText.color} />}
                    <Text style={styles.openPactEyebrowText}>{eyebrow}</Text>
                </View>
            )}

            <View style={styles.openPactHeader}>
                <View style={styles.habitCardEmojiContainer}>
                    <Text style={styles.habitCardEmojiContained}>
                        {pact.habitGoalEmoji || '🤝'}
                    </Text>
                </View>
                <View style={styles.habitCardTitleContainer}>
                    <Text style={styles.habitCardTitle} numberOfLines={2}>
                        {pact.habitGoalName}
                    </Text>
                    <Text style={styles.habitCardSubtitle} numberOfLines={1}>
                        {translate('pages.pacts.openPact.startedBy', { name: creatorName })}
                    </Text>
                </View>
            </View>

            {!!pitch && <Text style={styles.openPactPitch}>{pitch}</Text>}

            <View style={styles.openPactFactsRow}>
                <View style={styles.openPactChip}>
                    <MaterialIcon name="event" size={14} color={colors.onSurfaceMuted} />
                    <Text style={styles.openPactChipText}>
                        {translate('pages.pacts.openPact.durationChip', { days: pact.durationDays })}
                    </Text>
                </View>
                <View style={[styles.openPactChip, isRunning && styles.openPactChipActive]}>
                    <MaterialIcon
                        name={isRunning ? 'play-circle-outline' : 'hourglass-empty'}
                        size={14}
                        color={isRunning ? colors.alertSuccess : colors.onSurfaceMuted}
                    />
                    <Text style={[styles.openPactChipText, isRunning && styles.openPactChipTextActive]}>
                        {translate(isRunning
                            ? 'pages.pacts.openPact.rowRunning'
                            : 'pages.pacts.openPact.rowStarting')}
                    </Text>
                </View>
            </View>

            <View style={styles.openPactSeatsRow}>
                {renderSeatDots()}
                <Text style={styles.openPactSeatsText}>
                    {translate(seatsLabel.key, seatsLabel.params)}
                    {seats.total !== null && (
                        <Text style={styles.openPactSeatsTextMuted}>
                            {` · ${translate('pages.pacts.openPact.spotsFilled', { count: seats.filled, total: seats.total })}`}
                        </Text>
                    )}
                </Text>
            </View>

            {renderAction()}

            {footer}
        </View>
    );
};

export default OpenPactListingCard;
