import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SavingsTargetScopes } from 'therr-js-utilities/constants';
import { ISavingsProgress, IPactMember } from 'therr-react/types';
import { formatSavingsAmount, getSavingsProgressFraction } from '../../utilities/savingsFormat';

/**
 * How much a savings pact has put away, and who put it there.
 *
 * Every number here is derived server-side (`savingsProgress` on the pact detail
 * response) rather than summed from the check-ins the client happens to be holding.
 * The client only ever has a page of check-ins, so summing locally would understate a
 * long-running pact by however much had scrolled off — and understating someone's
 * savings is the one error this screen cannot make.
 */

export interface ISavingsProgressCardProps {
    progress: ISavingsProgress;
    /** For naming members; the response carries only user ids. */
    members?: IPactMember[];
    currentUserId?: string;
    translate: (key: string, params?: any) => string;
    themeHabits: any;
    locale?: string;
}

const SavingsProgressCard: React.FC<ISavingsProgressCardProps> = ({
    progress,
    members,
    currentUserId,
    translate,
    themeHabits,
    locale,
}) => {
    const {
        targetAmount, currencyCode, scope, totalSaved, isGoalReached, viewerTotalSaved, remainingAmount,
    } = progress;

    const isGroupScope = scope === SavingsTargetScopes.GROUP;
    // Under group scope the bar tracks the pot; under per-member scope it tracks the
    // viewer's own progress, because that is the number they can act on today.
    const fraction = getSavingsProgressFraction(
        isGroupScope ? totalSaved : viewerTotalSaved,
        targetAmount,
    );

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
                {translate('pages.habits.savings.cardTitle')}
            </Text>

            <Text style={localStyles.total}>
                {formatSavingsAmount(totalSaved, currencyCode, locale)}
            </Text>
            <Text style={themeHabits.styles.habitCardSubtitle}>
                {targetAmount === null
                    // An open-ended savings habit has no finish line. Saying "saved so
                    // far" rather than showing a 0% bar is the honest rendering.
                    ? translate('pages.habits.savings.totalSavedNoTarget')
                    : translate(isGroupScope
                        ? 'pages.habits.savings.totalSavedOfGroupTarget'
                        : 'pages.habits.savings.totalSavedGroupSubtitle', {
                        target: formatSavingsAmount(targetAmount, currencyCode, locale),
                    })}
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

            {isGoalReached ? (
                <Text style={[localStyles.statusLine, { color: themeHabits.colors.alertSuccess }]}>
                    {translate('pages.habits.savings.goalReached')}
                </Text>
            ) : null}
            {!isGoalReached && remainingAmount !== null ? (
                <Text style={[localStyles.statusLine, themeHabits.styles.habitCardSubtitle]}>
                    {translate(isGroupScope
                        ? 'pages.habits.savings.remainingGroup'
                        : 'pages.habits.savings.remainingYours', {
                        amount: formatSavingsAmount(remainingAmount, currencyCode, locale),
                    })}
                </Text>
            ) : null}

            {progress.members?.length ? (
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
                            {/* A member who has reached their own target is marked, but only
                                under per-member scope — under group scope the target belongs
                                to the pact and no individual has "reached" it. */}
                            {member.hasReachedTarget ? (
                                <Text style={localStyles.memberCheck}>{'✅'}</Text>
                            ) : null}
                            <Text style={[themeHabits.styles.habitCardTitle, localStyles.memberAmount]}>
                                {formatSavingsAmount(member.totalSaved, currencyCode, locale)}
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

export default SavingsProgressCard;
