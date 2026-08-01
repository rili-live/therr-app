import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Dialog, Divider, Portal } from 'react-native-paper';
import { ScrollView } from 'react-native-gesture-handler';
import {
    SELF_CONCEPT_MAX_SCORE,
    SELF_CONCEPT_MIN_SCORE,
} from 'therr-js-utilities/config';
import { ITherrThemeColors } from '../../styles/themes';
import ModalButton from '../Modals/ModalButton';

/**
 * What the sheet is collecting. `label` is the identity statement itself; the
 * others are reflections, and `promptKey` selects the copy.
 */
export type IdentityPromptMode = 'label' | 'text' | 'scale';

interface IIdentityPromptSheetProps {
    isVisible: boolean;
    isSubmitting?: boolean;
    mode: IdentityPromptMode;
    /** i18n key suffix under `pages.habits.identity.prompts.` — ignored for `label`. */
    promptKey?: string;
    /** Pre-fills the input when editing an existing identity statement. */
    initialValue?: string;
    habitName?: string;
    onCancel: () => void;
    onConfirm: (args: { text?: string; score?: number }) => void;
    translate: (key: string, params?: any) => string;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeConfirmModal: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const MAX_LABEL_LENGTH = 120; // matches the users-service column and its validator
const MAX_REFLECTION_LENGTH = 2000;

const SCALE_VALUES = Array.from(
    { length: SELF_CONCEPT_MAX_SCORE - SELF_CONCEPT_MIN_SCORE + 1 },
    (_, i) => SELF_CONCEPT_MIN_SCORE + i,
);

const localStyles = StyleSheet.create({
    transparentBorder: {
        borderColor: 'transparent',
    },
    counter: {
        alignSelf: 'flex-end',
        fontSize: 12,
        marginTop: 6,
    },
});

/**
 * Collects the identity statement, or a single reflection answer.
 *
 * One question at a time, always dismissible. These prompts are the mindset layer
 * of the habit -> mindset -> identity ladder, and their value depends entirely on
 * being answered honestly — a prompt that feels mandatory gets a throwaway answer,
 * which is worse than no answer because the ladder then counts it as evidence.
 */
const IdentityPromptSheet: React.FC<IIdentityPromptSheetProps> = ({
    isVisible,
    isSubmitting = false,
    mode,
    promptKey,
    initialValue,
    habitName,
    onCancel,
    onConfirm,
    translate,
    themeHabits,
    themeConfirmModal,
    themeButtons,
}) => {
    const [text, setText] = useState(initialValue || '');
    const [score, setScore] = useState<number | null>(null);

    // Re-seed on open so editing an existing statement starts from it, and a
    // reopened prompt never shows the previous question's answer.
    useEffect(() => {
        if (isVisible) {
            setText(initialValue || '');
            setScore(null);
        }
    }, [isVisible, initialValue]);

    const isScale = mode === 'scale';
    const isLabel = mode === 'label';
    const maxLength = isLabel ? MAX_LABEL_LENGTH : MAX_REFLECTION_LENGTH;
    const copyPrefix = isLabel
        ? 'pages.habits.identity.labelPrompt'
        : `pages.habits.identity.prompts.${promptKey}`;

    const canSubmit = !isSubmitting && (isScale ? score !== null : !!text.trim());

    const handleConfirm = () => {
        if (!canSubmit) {
            return;
        }
        if (isScale) {
            onConfirm({ score: score as number });
            return;
        }
        onConfirm({ text: text.trim() });
    };

    return (
        <Portal>
            <Dialog
                visible={isVisible}
                onDismiss={onCancel}
                style={themeConfirmModal.styles.container}
            >
                <Dialog.Title style={themeConfirmModal.styles.headerText}>
                    {translate(`${copyPrefix}.title`)}
                </Dialog.Title>
                <Divider />
                <Dialog.ScrollArea style={[themeConfirmModal.styles.body, localStyles.transparentBorder]}>
                    <ScrollView keyboardShouldPersistTaps="handled">
                        {habitName ? (
                            <Text style={themeHabits.styles.identityPromptTitle}>{habitName}</Text>
                        ) : null}
                        <Text style={themeHabits.styles.identityPromptBody}>
                            {translate(`${copyPrefix}.body`)}
                        </Text>

                        {isScale ? (
                            <>
                                <View style={themeHabits.styles.identityScaleRow}>
                                    {SCALE_VALUES.map((value) => (
                                        <Pressable
                                            key={value}
                                            onPress={() => setScore(value)}
                                            disabled={isSubmitting}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: score === value }}
                                            style={[
                                                themeHabits.styles.identityScaleOption,
                                                score === value
                                                    ? themeHabits.styles.identityScaleOptionSelected
                                                    : undefined,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    themeHabits.styles.identityScaleOptionText,
                                                    score === value
                                                        ? themeHabits.styles.identityScaleOptionTextSelected
                                                        : undefined,
                                                ]}
                                            >
                                                {value}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <View style={themeHabits.styles.identityScaleAnchorRow}>
                                    <Text style={themeHabits.styles.identityScaleAnchorText}>
                                        {translate(`${copyPrefix}.lowAnchor`)}
                                    </Text>
                                    <Text style={themeHabits.styles.identityScaleAnchorText}>
                                        {translate(`${copyPrefix}.highAnchor`)}
                                    </Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <TextInput
                                    value={text}
                                    onChangeText={setText}
                                    placeholder={translate(`${copyPrefix}.placeholder`)}
                                    placeholderTextColor={themeConfirmModal.colors.textGray}
                                    multiline={!isLabel}
                                    maxLength={maxLength}
                                    editable={!isSubmitting}
                                    style={themeHabits.styles.identityPromptInput}
                                />
                                <Text
                                    style={[
                                        localStyles.counter,
                                        { color: themeConfirmModal.colors.textGray },
                                    ]}
                                >
                                    {text.length}/{maxLength}
                                </Text>
                            </>
                        )}
                    </ScrollView>
                </Dialog.ScrollArea>
                <Divider />
                <Dialog.Actions style={themeConfirmModal.styles.buttonsContainer}>
                    <ModalButton
                        iconName="close"
                        title={translate('pages.habits.identity.promptSkip')}
                        onPress={onCancel}
                        disabled={isSubmitting}
                        iconRight={false}
                        themeButtons={themeButtons}
                    />
                    <ModalButton
                        iconName="check-circle"
                        title={translate('pages.habits.identity.promptSave')}
                        onPress={handleConfirm}
                        disabled={!canSubmit}
                        iconRight={true}
                        themeButtons={themeButtons}
                    />
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

export default IdentityPromptSheet;
