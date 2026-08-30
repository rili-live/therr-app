import React, { useEffect } from 'react';
import {
    BackHandler,
    Pressable,
    Text,
    View,
} from 'react-native';
import { Portal } from 'react-native-paper';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { bottomSafeAreaInset } from '../../styles/navigation/buttonMenu';

interface IJournalCreateMenuProps {
    isVisible: boolean;
    themeJournal: any;
    translate: (key: string, params?: any) => string;
    onCancel: () => void;
    onSelectEntry: () => void;
    onSelectGoal: () => void;
}

/**
 * The chooser behind the journal's `+`: a private journal entry, or a goal post.
 *
 * The two write to different places and that difference matters to the user, so
 * the pick happens up front rather than as a toggle inside one composer. A
 * journal entry is `habits.journal_entries` — private, day-filed, only ever
 * visible to its author. A goal is a `main.thoughts` row created through the
 * shared `EditThought` screen, which can be public and therefore also surfaces
 * on the profile's Goals tab and in the wider content feeds. Wording the
 * subtitles around visibility is the whole point of the sheet.
 *
 * Rendered through Paper's `Portal` rather than React Native's `Modal`, because
 * picking "journal entry" opens `JournalComposer`, which IS an RN `Modal`. On
 * iOS a modal presented while another is still dismissing silently fails to
 * appear, so a native sheet here would leave the composer dead on the first tap.
 * A portal is in-tree, which costs the free hardware-back handling that
 * `onRequestClose` would have given — hence the `BackHandler` below.
 */
const JournalCreateMenu = ({
    isVisible,
    themeJournal,
    translate,
    onCancel,
    onSelectEntry,
    onSelectGoal,
}: IJournalCreateMenuProps) => {
    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            onCancel();

            // Swallow the press so Android does not also pop the Journal screen.
            return true;
        });

        return () => subscription.remove();
    }, [isVisible, onCancel]);

    if (!isVisible) {
        return null;
    }

    const options = [
        {
            key: 'entry',
            icon: 'edit-note',
            title: translate('pages.journal.create.entryTitle'),
            subtitle: translate('pages.journal.create.entrySubtitle'),
            onPress: onSelectEntry,
        },
        {
            key: 'goal',
            icon: 'flag',
            title: translate('pages.journal.create.goalTitle'),
            subtitle: translate('pages.journal.create.goalSubtitle'),
            onPress: onSelectGoal,
        },
    ];

    return (
        <Portal>
            <SafeAreaInsetsContext.Consumer>
                {(insets) => (
                    <View style={themeJournal.styles.composerBackdrop}>
                        {/* Tapping the dimmed area dismisses, matching the app's other sheets. */}
                        <Pressable style={{ flex: 1 }} onPress={onCancel} accessibilityRole="button" />
                        <View
                            style={[
                                themeJournal.styles.composerSheet,
                                // The static inset is a cold-start fallback; the measured
                                // one is authoritative once the first layout pass has run.
                                { paddingBottom: (insets?.bottom ?? bottomSafeAreaInset) + 16 },
                            ]}
                        >
                            <Text style={themeJournal.styles.composerTitle}>
                                {translate('pages.journal.create.title')}
                            </Text>
                            {options.map((option) => (
                                <Pressable
                                    key={option.key}
                                    accessibilityRole="button"
                                    accessibilityLabel={option.title}
                                    accessibilityHint={option.subtitle}
                                    onPress={option.onPress}
                                    style={({ pressed }) => [
                                        themeJournal.styles.createOptionRow,
                                        pressed && themeJournal.styles.createOptionRowPressed,
                                    ]}
                                >
                                    <View style={themeJournal.styles.createOptionIconCircle}>
                                        <MaterialIcon
                                            name={option.icon}
                                            size={24}
                                            color={themeJournal.typePalette.goal.accent}
                                        />
                                    </View>
                                    <View style={themeJournal.styles.createOptionTextGroup}>
                                        <Text style={themeJournal.styles.createOptionTitle}>
                                            {option.title}
                                        </Text>
                                        <Text style={themeJournal.styles.createOptionSubtitle}>
                                            {option.subtitle}
                                        </Text>
                                    </View>
                                    <MaterialIcon
                                        name="chevron-right"
                                        size={22}
                                        color={themeJournal.colors.onSurfaceMuted}
                                    />
                                </Pressable>
                            ))}
                            <View style={themeJournal.styles.composerActions}>
                                <Pressable
                                    accessibilityRole="button"
                                    style={themeJournal.styles.composerButton}
                                    onPress={onCancel}
                                >
                                    <Text style={themeJournal.styles.composerButtonLabel}>
                                        {translate('pages.journal.composer.cancel')}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                )}
            </SafeAreaInsetsContext.Consumer>
        </Portal>
    );
};

export default JournalCreateMenu;
