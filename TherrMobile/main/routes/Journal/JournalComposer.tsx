import React, { useEffect, useState } from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { IUserHabit } from 'therr-react/types';
import { getJournalSwatchIndex } from '../../styles/habits/journalPalette';

interface IJournalComposerProps {
    isVisible: boolean;
    isSaving: boolean;
    habits: IUserHabit[];
    /** Habit -> palette slot, built once by the screen so the dots match the feed. */
    habitSwatchAssignment: Record<string, number>;
    initialBody?: string;
    initialHabitGoalId?: string | null;
    themeJournal: any;
    translate: (key: string, params?: any) => string;
    onCancel: () => void;
    onSave: (body: string, habitGoalId: string | null) => void;
}

/**
 * The `+` composer: free text, plus an optional habit tag.
 *
 * The tag is optional by design — the journal's most valuable entries are often
 * the ones that do not belong to a habit at all ("I woke up before the alarm
 * which felt good"), and forcing a tag would push people to mis-file them.
 *
 * `KeyboardAvoidingView` comes from `react-native-keyboard-controller`, not
 * React Native core: the app runs edge-to-edge with `adjustResize`, where the
 * built-in one under-reports the keyboard and leaves the input covered.
 */
const JournalComposer = ({
    isVisible,
    isSaving,
    habits,
    habitSwatchAssignment,
    initialBody,
    initialHabitGoalId,
    themeJournal,
    translate,
    onCancel,
    onSave,
}: IJournalComposerProps) => {
    const [body, setBody] = useState(initialBody || '');
    const [habitGoalId, setHabitGoalId] = useState<string | null>(initialHabitGoalId || null);

    // Re-seed whenever the sheet opens. Without this, editing one entry and then
    // opening the composer again shows the previous entry's text, because the
    // component stays mounted between opens.
    useEffect(() => {
        if (isVisible) {
            setBody(initialBody || '');
            setHabitGoalId(initialHabitGoalId || null);
        }
    }, [isVisible, initialBody, initialHabitGoalId]);

    const trimmed = body.trim();
    const canSave = !!trimmed && !isSaving;

    return (
        <Modal
            animationType="slide"
            transparent
            visible={isVisible}
            onRequestClose={onCancel}
        >
            <KeyboardAvoidingView behavior="padding" style={themeJournal.styles.composerBackdrop}>
                {/* Tapping the dimmed area dismisses, matching the app's other sheets. */}
                <Pressable style={{ flex: 1 }} onPress={onCancel} accessibilityRole="button" />
                <View style={themeJournal.styles.composerSheet}>
                    <Text style={themeJournal.styles.composerTitle}>
                        {translate('pages.journal.composer.title')}
                    </Text>
                    <TextInput
                        style={themeJournal.styles.composerInput}
                        multiline
                        autoFocus
                        value={body}
                        onChangeText={setBody}
                        placeholder={translate('pages.journal.composer.placeholder')}
                        placeholderTextColor={themeJournal.colors.onSurfaceMuted}
                        accessibilityLabel={translate('pages.journal.composer.title')}
                    />

                    {habits.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={themeJournal.styles.composerTagRow}>
                                {habits.map((habit) => {
                                    const isSelected = habitGoalId === habit.habitGoalId;
                                    const swatch = themeJournal.palette[
                                        getJournalSwatchIndex(habit.habitGoalId, habitSwatchAssignment)
                                    ];

                                    return (
                                        <Pressable
                                            key={habit.id}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: isSelected }}
                                            style={[
                                                themeJournal.styles.composerTag,
                                                // Selecting a tag fills it in that habit's own color,
                                                // so the composer previews what the saved entry will
                                                // look like in the feed.
                                                isSelected && {
                                                    backgroundColor: swatch.tint,
                                                    borderColor: swatch.accent,
                                                },
                                            ]}
                                            // Tapping the selected tag clears it, so an entry can be
                                            // untagged again without reopening the composer.
                                            onPress={() => setHabitGoalId(isSelected ? null : habit.habitGoalId)}
                                        >
                                            <View style={[
                                                themeJournal.styles.composerTagDot,
                                                { backgroundColor: swatch.accent },
                                            ]}
                                            />
                                            <Text style={themeJournal.styles.composerTagLabel}>
                                                {habit.goalEmoji ? `${habit.goalEmoji} ` : ''}
                                                {habit.goalName}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    )}

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
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !canSave }}
                            disabled={!canSave}
                            style={[
                                themeJournal.styles.composerButton,
                                themeJournal.styles.composerButtonPrimary,
                                !canSave && { opacity: 0.5 },
                            ]}
                            onPress={() => onSave(trimmed, habitGoalId)}
                        >
                            <Text style={themeJournal.styles.composerButtonLabelPrimary}>
                                {translate('pages.journal.composer.save')}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default JournalComposer;
