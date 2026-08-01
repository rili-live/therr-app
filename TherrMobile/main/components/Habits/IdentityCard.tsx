import React from 'react';
import { View, Text, Pressable } from 'react-native';
import {
    IDENTITY_STAGE_KEYS,
    IDENTITY_STAGE_ORDER,
    IdentityStages,
} from 'therr-js-utilities/config';
import { IIdentitySnapshot } from 'therr-react/types';
import { ITherrThemeColors } from '../../styles/themes';

interface IIdentityCardProps {
    snapshot?: IIdentitySnapshot | null;
    onNameIdentity: () => void;
    themeHabits: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const STAGE_EMOJIS: { [stage: number]: string } = {
    [IdentityStages.INTENTION]: '🌱', // seedling
    [IdentityStages.REPETITION]: '🔁', // repeat
    [IdentityStages.AUTOMATICITY]: '⚙️', // gear
    [IdentityStages.MINDSET]: '🧠', // brain
    [IdentityStages.IDENTITY]: '🪞', // mirror
};

/**
 * The identity ladder for one habit — the app's answer to "who is this making me?"
 *
 * Sits above the streak widget deliberately. A streak answers "how many days in a
 * row", and resets to zero on the day the user most needs a reason to continue.
 * The vote count here never resets, and the stage never drops, so this card still
 * has something true to say after a bad week.
 *
 * Presentational only: the stage and its requirements are evaluated server-side
 * against `evaluateIdentityStage` and arrive in `snapshot.evaluation`.
 */
const IdentityCard: React.FC<IIdentityCardProps> = ({
    snapshot,
    onNameIdentity,
    themeHabits,
    translate,
}) => {
    const progress = snapshot?.progress;
    const evaluation = snapshot?.evaluation;
    const stage = evaluation?.stage ?? progress?.stage ?? IdentityStages.INTENTION;
    const votesCast = progress?.votesCast ?? 0;
    const hasIdentityLabel = !!progress?.identityLabel;

    // One next step, not a checklist. `unmetRequirements` is sorted worst-progress
    // first, so the last entry is the requirement nearest to being met — the one
    // worth naming. Listing all four turns the card into an inventory of
    // everything the user hasn't done, which is the opposite of the point.
    const nextRequirement = evaluation?.unmetRequirements?.[evaluation.unmetRequirements.length - 1];
    const nextStageKey = evaluation?.nextStageKey;

    return (
        <View style={themeHabits.styles.identityCardContainer}>
            <Text style={themeHabits.styles.identityCardEyebrow}>
                {translate('pages.habits.identity.eyebrow')}
            </Text>

            {hasIdentityLabel ? (
                <Text style={themeHabits.styles.identityStatement}>
                    {translate('pages.habits.identity.statement', { label: progress?.identityLabel })}
                </Text>
            ) : (
                <Text style={themeHabits.styles.identityStatementPlaceholder}>
                    {translate('pages.habits.identity.unnamedPrompt')}
                </Text>
            )}

            {votesCast > 0 && (
                <View style={themeHabits.styles.identityVotesRow}>
                    <Text style={themeHabits.styles.identityVotesCount}>{votesCast}</Text>
                    <Text style={themeHabits.styles.identityVotesLabel}>
                        {translate(
                            votesCast === 1
                                ? 'pages.habits.identity.voteSingular'
                                : 'pages.habits.identity.votePlural',
                        )}
                    </Text>
                </View>
            )}

            <View style={themeHabits.styles.identityLadder}>
                {IDENTITY_STAGE_ORDER.map((rung) => (
                    <View
                        key={IDENTITY_STAGE_KEYS[rung]}
                        style={[
                            themeHabits.styles.identityRung,
                            rung <= stage ? themeHabits.styles.identityRungReached : undefined,
                        ]}
                    >
                        {/* Partial fill on the rung being worked toward. */}
                        {rung === stage + 1 && (
                            <View
                                style={[
                                    themeHabits.styles.identityRungFill,
                                    { width: `${Math.min(evaluation?.progressToNextStage ?? 0, 100)}%` },
                                ]}
                            />
                        )}
                    </View>
                ))}
            </View>

            <View style={themeHabits.styles.identityStageRow}>
                <Text style={themeHabits.styles.identityStageTitle}>
                    {STAGE_EMOJIS[stage]}{' '}
                    {translate(`pages.habits.identity.stages.${IDENTITY_STAGE_KEYS[stage]}.title`)}
                </Text>
                {nextStageKey && (
                    <Text style={themeHabits.styles.identityStageProgress}>
                        {evaluation?.progressToNextStage ?? 0}%
                    </Text>
                )}
            </View>

            <Text style={themeHabits.styles.identityStageBlurb}>
                {translate(`pages.habits.identity.stages.${IDENTITY_STAGE_KEYS[stage]}.blurb`)}
            </Text>

            {nextStageKey && nextRequirement && (
                <Text style={themeHabits.styles.identityNextHint}>
                    {translate(`pages.habits.identity.next.${nextRequirement.key}`, {
                        threshold: nextRequirement.threshold,
                        actual: nextRequirement.actual ?? 0,
                        remaining: Math.max(0, Math.ceil(nextRequirement.threshold - (nextRequirement.actual ?? 0))),
                        // Ratio requirements (consistency) read as percentages —
                        // "0.6" is not a sentence anyone wants to be handed.
                        thresholdPercent: Math.round(nextRequirement.threshold * 100),
                        actualPercent: Math.round((nextRequirement.actual ?? 0) * 100),
                        stage: translate(`pages.habits.identity.stages.${nextStageKey}.title`),
                    })}
                </Text>
            )}

            {/* Dormancy is worded as a return, not a failure — the stage and the
                vote count are still intact, and saying so is the whole point. */}
            {snapshot?.isDormant && (
                <Text style={themeHabits.styles.identityDormantNote}>
                    {translate('pages.habits.identity.dormant', { days: snapshot.daysSinceLastVote })}
                </Text>
            )}

            <Pressable
                style={themeHabits.styles.identityActionButton}
                onPress={onNameIdentity}
                accessibilityRole="button"
            >
                <Text style={themeHabits.styles.identityActionButtonText}>
                    {translate(hasIdentityLabel
                        ? 'pages.habits.identity.editLabelCta'
                        : 'pages.habits.identity.nameItCta')}
                </Text>
            </Pressable>
        </View>
    );
};

export default IdentityCard;
