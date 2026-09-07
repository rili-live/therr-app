import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { IJournalFeedItem } from 'therr-react/types';
import { IJournalSwatch } from '../../styles/habits/journalPalette';
import { formatEntryTime } from './journalGrouping';

interface IJournalEntryRowProps {
    item: IJournalFeedItem;
    locale: string;
    themeJournal: any;
    /**
     * The row's color, resolved by the screen so every row of one habit is
     * looked up against the same assignment. See `styles/habits/journalPalette`.
     */
    swatch: IJournalSwatch;
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

/**
 * The glyph that says what a row *is*, in the disc the row's habit colors.
 *
 * Splitting the two signals — shape for type, hue for habit — is what lets a
 * day of mixed rows stay readable: neither has to give up its slot, and neither
 * is decoration. A skipped check-in gets its own glyph rather than a different
 * color, so it never reads as a different habit.
 */
const getIconName = (item: IJournalFeedItem): string => {
    switch (item.type) {
        case 'checkin':
            return item.meta?.status === 'skipped' ? 'remove-circle-outline' : 'check-circle';
        case 'achievement':
            return 'emoji-events';
        case 'milestone':
            return 'local-fire-department';
        case 'habit_started':
            return 'flag';
        case 'goal':
            return 'campaign';
        case 'note':
        default:
            return 'edit-note';
    }
};

const JournalEntryRow = ({
    item,
    locale,
    themeJournal,
    swatch,
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
        <View style={[themeJournal.styles.entry, { borderLeftColor: swatch.accent }]}>
            {/*
              * The glyph repeats what the body text already says ("Completed
              * Running"), so it is hidden from the accessibility tree rather
              * than given a label that would be read out twice.
              */}
            <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[themeJournal.styles.entryIconCircle, { backgroundColor: swatch.tint }]}
            >
                <MaterialIcon
                    name={getIconName(item)}
                    size={16}
                    color={swatch.accent}
                />
            </View>
            <View style={themeJournal.styles.entryContent}>
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
                        <View style={[themeJournal.styles.chip, { backgroundColor: swatch.tint }]}>
                            <Text style={[themeJournal.styles.chipHabitLabel, { color: swatch.accent }]}>
                                {habitLabel}
                            </Text>
                        </View>
                    )}
                </View>
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
