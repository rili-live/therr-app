import React from 'react';
import { Pressable, Text } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IOpenPact } from 'therr-react/types';
import { FeedPactPitch } from '../../utilities/feedOpenPacts';
import OpenPactListingCard from './OpenPactListingCard';

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
}

/** One icon per reason to join, so the pill reads before its words do. */
const PITCH_ICONS: Record<FeedPactPitch, string> = {
    interests: 'favorite',
    group: 'group',
    partner: 'person-search',
};

/**
 * One open pact between posts in the feed: why it is worth joining, what it is, and one tap to ask.
 * The card itself is the OpenPacts screen's (OpenPactListingCard), so a pact looks the same in both
 * places; the feed adds the reason it was picked and a way into the full list.
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
}: IFeedOpenPactCardProps) => {
    const creatorName = pact.creatorUserName || translate('pages.pacts.partnerFallback');

    return (
        <OpenPactListingCard
            pact={pact}
            maxMembers={maxMembers}
            isBusy={isBusy}
            isPending={isPending}
            onAskToJoin={onAskToJoin}
            onCancelRequest={onCancelRequest}
            eyebrow={translate(`pages.habits.feed.openPact.eyebrow.${pitch}`)}
            eyebrowIcon={PITCH_ICONS[pitch]}
            pitch={translate(`pages.habits.feed.openPact.pitch.${pitch}`, { name: creatorName })}
            translate={translate}
            themeHabits={themeHabits}
            footer={(
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={translate('pages.habits.feed.openPact.seeAll')}
                    onPress={onSeeAll}
                    style={({ pressed }) => [
                        themeHabits.styles.openPactFooterLink,
                        pressed && themeHabits.styles.pactPressedSurface,
                    ]}
                >
                    <Text style={themeHabits.styles.openPactFooterLinkText}>
                        {translate('pages.habits.feed.openPact.seeAll')}
                    </Text>
                    <MaterialIcon
                        name="chevron-right"
                        size={22}
                        color={themeHabits.styles.openPactFooterLinkText.color}
                    />
                </Pressable>
            )}
        />
    );
};

export default FeedOpenPactCard;
