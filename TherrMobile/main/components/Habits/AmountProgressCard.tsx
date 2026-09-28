import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IAmountProgress, IPactMember } from 'therr-react/types';
import { getSavingsProgressFraction } from '../../utilities/savingsFormat';
import { formatHabitAmount } from '../../utilities/habitAmountFormat';

/**
 * This week on a measured pact: the viewer's amount against the weekly target, and every
 * active member's amount, highest first.
 *
 * Every number comes from `amountProgress` on the pact detail response, summed server-side,
 * for the same reason `SavingsProgressCard` does not sum locally: the client only ever
 * holds a page of check-ins.
 */
export interface IAmountProgressCardProps {
    progress: IAmountProgress;
    /** For naming members; the response carries only user ids. */
    members?: IPactMember[];
    currentUserId?: string;
    translate: (key: string, params?: any) => string;
    themeHabits: any;
    locale?: string;
}

const AmountProgressCard: React.FC<IAmountProgressCardProps> = ({
    progress,
    members,
    currentUserId,
    translate,
    themeHabits,
    locale,
}) => {
    const {
        amountUnit, weeklyTargetAmount, viewerWeekAmount, groupWeekAmount,
    } = progress;
    const format = (amount: number) => formatHabitAmount(amount, amountUnit, translate, locale);
    const fraction = getSavingsProgressFraction(viewerWeekAmount, weeklyTargetAmount);
    const viewer = progress.members.find((member) => member.userId === currentUserId);

    const nameFor = (userId: string): string => {
        if (userId === currentUserId) {
            return translate('pages.pacts.you');
        }

        const member = members?.find((m) => m.userId === userId);

        return member?.userName
            || [member?.firstName, member?.lastName].filter(Boolean).join(' ')
            || translate('pages.habits.savings.unknownMember');
    };

    return (
        <View style={themeHabits.styles.streakWidgetContainer}>
            <Text style={themeHabits.styles.streakWidgetTitle}>
                {translate('pages.habits.amounts.cardTitle')}
            </Text>

            <Text style={localStyles.total}>{format(viewerWeekAmount)}</Text>
            <Text style={themeHabits.styles.habitCardSubtitle}>
                {weeklyTargetAmount == null
                    ? translate('pages.habits.amounts.weekNoTarget')
                    : translate('pages.habits.amounts.weekOfTarget', { target: format(weeklyTargetAmount) })}
            </Text>

            {fraction !== null ? (
                <View style={localStyles.barTrack} accessibilityRole="progressbar">
                    <View
                        style={[
                            localStyles.barFill,
                            {
                                width: `${Math.round(fraction * 100)}%`,
                                backgroundColor: themeHabits.colors.primary3,
                            },
                        ]}
                    />
                </View>
            ) : null}

            {viewer?.hasReachedWeeklyTarget ? (
                <Text style={[localStyles.statusLine, { color: themeHabits.colors.alertSuccess }]}>
                    {translate('pages.habits.amounts.weeklyTargetReached')}
                </Text>
            ) : null}

            {progress.members.length > 1 ? (
                <Text style={[localStyles.statusLine, themeHabits.styles.habitCardSubtitle]}>
                    {translate('pages.habits.amounts.groupWeek', { amount: format(groupWeekAmount) })}
                </Text>
            ) : null}

            {progress.members.length ? (
                <View style={localStyles.breakdown}>
                    {progress.members.map((member, index) => (
                        <View
                            key={member.userId}
                            style={[
                                localStyles.memberRow,
                                index > 0 ? {
                                    borderTopWidth: 1,
                                    borderTopColor: themeHabits.colors.textGray,
                                } : null,
                            ]}
                        >
                            <Text
                                numberOfLines={1}
                                style={[themeHabits.styles.habitCardSubtitle, localStyles.memberName]}
                            >
                                {nameFor(member.userId)}
                            </Text>
                            {member.hasReachedWeeklyTarget ? (
                                <Text style={localStyles.memberCheck}>{'✅'}</Text>
                            ) : null}
                            <Text style={[themeHabits.styles.habitCardTitle, localStyles.memberAmount]}>
                                {format(member.weekAmount)}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

const localStyles = StyleSheet.create({
    total: {
        fontSize: 30,
        fontWeight: '700',
        paddingTop: 4,
    },
    barTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.12)',
        marginTop: 12,
        overflow: 'hidden',
    },
    barFill: {
        height: 8,
        borderRadius: 4,
    },
    statusLine: {
        paddingTop: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    breakdown: {
        marginTop: 14,
    },
    memberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
    },
    memberName: {
        flex: 1,
    },
    memberCheck: {
        fontSize: 14,
    },
    memberAmount: {
        fontSize: 15,
    },
});

export default AmountProgressCard;
