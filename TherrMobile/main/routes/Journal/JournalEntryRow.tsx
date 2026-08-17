import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { IJournalFeedItem } from 'therr-react/types';
import { formatEntryTime } from './journalGrouping';

interface IJournalEntryRowProps {
    item: IJournalFeedItem;
    locale: string;
    themeJournal: any;
    translate: (key: string, params?: any) => string;
    /** Opens the composer to edit a note. */
    onPress?: (item: IJournalFeedItem) => void;
    /** Opens a posted goal in the thought view. */
    onPressGoal?: (item: IJournalFeedItem) => void;
}

/**
 * One line of the journal.
 *
 * Six item types share this row. Notes, check-ins and goals carry text the user
 * wrote; achievements, milestones and habit starts are events, so their body is
 * generated from the locale dictionary rather than left blank — an empty row
 * would read as a bug.
 */
const getBody = (
    item: IJournalFeedItem,
    translate: (key: string, params?: any) => string,
): string => {
    if (item.body) {
        return item.body;
    }

    switch (item.type) {
        case 'achievement':
            return translate('pages.journal.entry.achievementEarned', {
                achievement: item.meta?.achievementClass || '',
            });
        case 'milestone':
            return translate('pages.journal.entry.milestoneReached', {
                days: item.meta?.milestoneReached ?? item.meta?.streakAfter ?? 0,
            });
        case 'habit_started':
            return translate('pages.journal.entry.habitStarted', {
                habit: item.goalName || '',
            });
        case 'checkin':
            // A check-in with no note still says something: that it happened.
            return item.meta?.status === 'skipped'
                ? translate('pages.journal.entry.checkinSkipped', { habit: item.goalName || '' })
                : translate('pages.journal.entry.checkinCompleted', { habit: item.goalName || '' });
        default:
            return '';
    }
};

const JournalEntryRow = ({
    item,
    locale,
    themeJournal,
    translate,
    onPress,
    onPressGoal,
}: IJournalEntryRowProps) => {
    const time = formatEntryTime(item.occurredAt, locale);
    const habitLabel = item.goalName
        ? `${item.goalName}${item.goalEmoji ? ` ${item.goalEmoji}` : ''}`
        : null;
    const isGoal = item.type === 'goal';
    // Notes open the composer; goals open the post they came from. Everything
    // else is a record of something that happened, with nothing to open or edit.
    let handlePress: ((pressed: IJournalFeedItem) => void) | undefined;
    if (isGoal) {
        handlePress = onPressGoal;
    } else if (item.type === 'note') {
        handlePress = onPress;
    }

    const accessibilityLabel = isGoal
        ? translate('pages.journal.entry.goalAccessibility')
        : translate('pages.journal.entry.editAccessibility');

    const content = (
        <View style={themeJournal.styles.entry}>
            <Text style={themeJournal.styles.entryBody}>{getBody(item, translate)}</Text>
            <View style={themeJournal.styles.entryMetaRow}>
                {!!time && (
                    <View style={[themeJournal.styles.chip, themeJournal.styles.chipTime]}>
                        <Text style={themeJournal.styles.chipLabel}>{time}</Text>
                    </View>
                )}
                {isGoal && (
                    <View style={[themeJournal.styles.chip, themeJournal.styles.chipGoal]}>
                        <Text style={themeJournal.styles.chipGoalLabel}>
                            {translate('pages.journal.entry.goalChip')}
                        </Text>
                    </View>
                )}
                {!!habitLabel && (
                    <View style={[themeJournal.styles.chip, themeJournal.styles.chipTime]}>
                        <Text style={themeJournal.styles.chipHabitLabel}>{habitLabel}</Text>
                    </View>
                )}
            </View>
        </View>
    );

    if (!handlePress) {
        return content;
    }

    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            onPress={() => handlePress(item)}
            style={({ pressed }) => (pressed ? themeJournal.styles.entryPressed : undefined)}
        >
            {content}
        </Pressable>
    );
};

export default JournalEntryRow;
