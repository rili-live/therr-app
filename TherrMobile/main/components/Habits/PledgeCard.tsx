import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
    IHabitPledge,
    PLEDGE_CHARITIES,
    PledgeCharityKey,
    getPledgeCharity,
} from 'therr-js-utilities/constants';
import { Button } from '../BaseButton';
import { ITherrThemeColors } from '../../styles/themes';
import { PLEDGE_AMOUNT_PRESETS, formatPledgeAmount, isPledgeStartingNextWeek } from '../../utilities/pactPledge';

/**
 * The viewer's own charity pledge on a pact (WORK_IN_PROGRESS § 2.8, Phase A): "if I miss my
 * week, $5 goes to charity." The app never takes the money; a missed week links out to the
 * charity's own donation page.
 *
 * Partners' pledges render on their `PactMemberRow`, not here — this card only edits the
 * viewer's own, which is all the server lets anyone edit.
 */

interface IPledgeCardProps {
    pledge: IHabitPledge | null;
    /** False on a pact the viewer is keeping alone. An existing pledge stays removable. */
    canAdd: boolean;
    isSaving: boolean;
    /** Resolves true once saved. The editor stays open on failure so nothing typed is lost. */
    onSave: (amount: number, charityKey: PledgeCharityKey) => Promise<boolean>;
    onRemove: () => void;
    locale?: string;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeButtons: {
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const PledgeCard: React.FC<IPledgeCardProps> = ({
    pledge,
    canAdd,
    isSaving,
    onSave,
    onRemove,
    locale,
    themeHabits,
    themeButtons,
    translate,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [amount, setAmount] = useState<number>(pledge?.amount || PLEDGE_AMOUNT_PRESETS[0]);
    const [charityKey, setCharityKey] = useState<PledgeCharityKey | null>(pledge?.charityKey || null);

    const startEditing = () => {
        // Always opened from what is saved, so a cancelled edit leaves nothing behind.
        setAmount(pledge?.amount || PLEDGE_AMOUNT_PRESETS[0]);
        setCharityKey(pledge?.charityKey || null);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!charityKey) {
            return;
        }
        onSave(amount, charityKey).then((isSaved) => {
            if (isSaved) {
                setIsEditing(false);
            }
        });
    };

    if (!pledge && !canAdd) {
        return (
            <View style={themeHabits.styles.streakWidgetContainer}>
                <Text style={themeHabits.styles.streakWidgetTitle}>
                    {translate('pages.pacts.pledge.title')}
                </Text>
                <Text style={themeHabits.styles.cadenceHint}>
                    {translate('pages.pacts.pledge.needsPartner')}
                </Text>
            </View>
        );
    }

    if (isEditing) {
        // An amount already saved that is not a preset (set from another client) stays offered,
        // so opening the editor never silently changes it.
        const amountOptions = PLEDGE_AMOUNT_PRESETS.includes(amount)
            ? PLEDGE_AMOUNT_PRESETS
            : [...PLEDGE_AMOUNT_PRESETS, amount].sort((a, b) => a - b);

        return (
            <View style={themeHabits.styles.streakWidgetContainer}>
                <Text style={themeHabits.styles.streakWidgetTitle}>
                    {translate('pages.pacts.pledge.title')}
                </Text>
                <Text style={themeHabits.styles.cadenceSectionLabel}>
                    {translate('pages.pacts.pledge.amountLabel')}
                </Text>
                <View style={themeHabits.styles.cadenceWeekdayRow}>
                    {amountOptions.map((option) => {
                        const isSelected = option === amount;
                        return (
                            <Pressable
                                key={option}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isSelected }}
                                onPress={() => setAmount(option)}
                                style={[
                                    themeHabits.styles.cadenceWeekdayChip,
                                    { paddingHorizontal: 12 },
                                    isSelected && themeHabits.styles.cadenceWeekdayChipSelected,
                                ]}
                            >
                                <Text style={[
                                    themeHabits.styles.cadenceWeekdayChipText,
                                    isSelected && themeHabits.styles.cadenceWeekdayChipTextSelected,
                                ]}>
                                    {formatPledgeAmount(option, locale)}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
                <Text style={themeHabits.styles.cadenceSectionLabel}>
                    {translate('pages.pacts.pledge.charityLabel')}
                </Text>
                {PLEDGE_CHARITIES.map((charity) => {
                    const isSelected = charity.key === charityKey;
                    return (
                        <Pressable
                            key={charity.key}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: isSelected }}
                            onPress={() => setCharityKey(charity.key)}
                            style={[
                                themeHabits.styles.cadenceOption,
                                isSelected && themeHabits.styles.cadenceOptionSelected,
                            ]}
                        >
                            <Text style={[
                                themeHabits.styles.cadenceOptionText,
                                isSelected && themeHabits.styles.cadenceOptionTextSelected,
                            ]}>
                                {charity.name}
                            </Text>
                            {isSelected && <View style={themeHabits.styles.choiceRadioDot} />}
                        </Pressable>
                    );
                })}
                <Button
                    buttonStyle={[themeButtons.styles.btnLargeWithText, { marginTop: 12 }]}
                    titleStyle={themeButtons.styles.btnLargeTitle}
                    title={translate('pages.pacts.pledge.save')}
                    onPress={handleSave}
                    loading={isSaving}
                    disabled={isSaving || !charityKey}
                />
                <Button
                    buttonStyle={[themeButtons.styles.btnClear, { marginTop: 8 }]}
                    titleStyle={themeButtons.styles.btnTitleBlack}
                    title={translate('pages.pacts.pledge.cancel')}
                    onPress={() => setIsEditing(false)}
                    disabled={isSaving}
                />
            </View>
        );
    }

    if (!pledge) {
        return (
            <View style={themeHabits.styles.streakWidgetContainer}>
                <Text style={themeHabits.styles.streakWidgetTitle}>
                    {translate('pages.pacts.pledge.title')}
                </Text>
                <Text style={themeHabits.styles.habitCardSubtitle}>
                    {translate('pages.pacts.pledge.explainer')}
                </Text>
                <Button
                    buttonStyle={[themeButtons.styles.btnClear, { marginTop: 12 }]}
                    titleStyle={themeButtons.styles.btnTitleBlack}
                    title={translate('pages.pacts.pledge.add')}
                    onPress={startEditing}
                    disabled={isSaving}
                />
            </View>
        );
    }

    return (
        <View style={themeHabits.styles.streakWidgetContainer}>
            <Text style={themeHabits.styles.streakWidgetTitle}>
                {translate('pages.pacts.pledge.title')}
            </Text>
            <Text style={themeHabits.styles.habitCardSubtitle}>
                {translate('pages.pacts.pledge.summary', {
                    amount: formatPledgeAmount(pledge.amount, locale),
                    charity: getPledgeCharity(pledge.charityKey)?.name,
                })}
            </Text>
            {isPledgeStartingNextWeek(pledge) && (
                <Text style={themeHabits.styles.cadenceHint}>
                    {translate('pages.pacts.pledge.startsNextWeek')}
                </Text>
            )}
            <Text style={themeHabits.styles.cadenceHint}>
                {translate('pages.pacts.pledge.visibleToPartners')}
            </Text>
            <Button
                buttonStyle={[themeButtons.styles.btnClear, { marginTop: 12 }]}
                titleStyle={themeButtons.styles.btnTitleBlack}
                title={translate('pages.pacts.pledge.edit')}
                onPress={startEditing}
                disabled={isSaving}
            />
            <Button
                buttonStyle={themeButtons.styles.btnClear}
                titleStyle={themeButtons.styles.btnTitleRed}
                title={translate('pages.pacts.pledge.remove')}
                onPress={onRemove}
                loading={isSaving}
                disabled={isSaving}
            />
        </View>
    );
};

export default PledgeCard;
