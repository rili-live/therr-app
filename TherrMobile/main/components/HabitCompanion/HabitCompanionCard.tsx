import React from 'react';
import { Text, View } from 'react-native';
import { getCompanionGrowth } from '../../utilities/companionGrowth';
import PixelChameleon from './PixelChameleon';

// 5 dp per sprite pixel: big enough that the pixels read as deliberate 8-bit art, small
// enough to leave the text column room on a 360 dp phone.
const SPRITE_RENDER_SIZE = 120;

interface IHabitCompanionCardProps {
    achievements: { [key: string]: any } | undefined | null;
    accountCreatedAt: string | undefined | null;
    brandVariation: string;
    themeAchievements: any;
    translate: (key: string, params?: any) => string;
}

/**
 * The habit companion card: the user's chameleon at its current growth stage, what the
 * stage is called, and what it still needs to reach the next one. Growth itself is derived
 * in utilities/companionGrowth.ts — this component only presents it.
 */
const HabitCompanionCard = ({
    achievements,
    accountCreatedAt,
    brandVariation,
    themeAchievements,
    translate,
}: IHabitCompanionCardProps) => {
    const growth = getCompanionGrowth({ achievements, accountCreatedAt, brandVariation });
    const { stage, stageIndex, stageCount, nextStage, nextAchievements, nextAccountAge, progressToNext } = growth;
    const { styles } = themeAchievements;

    const stageName = translate(`components.habitCompanion.stages.${stage.id}.name`);
    const stageOf = translate('components.habitCompanion.stageOf', { stage: stageIndex + 1, total: stageCount });
    const caption = nextStage
        ? translate(`components.habitCompanion.stages.${stage.id}.caption`)
        : translate('components.habitCompanion.fullyGrown');

    return (
        <View style={styles.companionCard}>
            <View style={styles.companionSpriteWell}>
                <PixelChameleon
                    stageId={stage.id}
                    themeColors={themeAchievements.colors}
                    size={SPRITE_RENDER_SIZE}
                    accessibilityLabel={translate('components.habitCompanion.a11yLabel', {
                        stageName,
                        stage: stageIndex + 1,
                        total: stageCount,
                    })}
                    accessibilityHint={translate('components.habitCompanion.tapHint')}
                />
            </View>
            <View style={styles.companionTextContainer}>
                <Text style={styles.achievementClassLabel} numberOfLines={1}>
                    {translate('components.habitCompanion.overline')}
                </Text>
                <Text style={styles.achievementTitle}>{stageName}</Text>
                <Text style={styles.companionStageOf}>{stageOf}</Text>
                <Text style={styles.achievementDescription}>{caption}</Text>
                {nextStage && nextAchievements && nextAccountAge && (
                    <>
                        <View style={[styles.progressRow, styles.companionProgressRow]}>
                            <View style={styles.progressBarTrack}>
                                <View style={[styles.progressBarFill, { width: `${progressToNext * 100}%` }]} />
                            </View>
                        </View>
                        <Text style={styles.companionRequirement}>
                            {translate('components.habitCompanion.nextStage', {
                                stageName: translate(`components.habitCompanion.stages.${nextStage.id}.name`),
                            })}
                        </Text>
                        <Text style={[styles.companionRequirement, nextAchievements.isMet && styles.companionRequirementMet]}>
                            {translate('components.habitCompanion.achievementsProgress', {
                                count: Math.min(nextAchievements.current, nextAchievements.required),
                                total: nextAchievements.required,
                            })}
                        </Text>
                        {nextAccountAge.required > 0 && (
                            <Text style={[styles.companionRequirement, nextAccountAge.isMet && styles.companionRequirementMet]}>
                                {translate('components.habitCompanion.daysProgress', {
                                    count: Math.min(nextAccountAge.current, nextAccountAge.required),
                                    total: nextAccountAge.required,
                                })}
                            </Text>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};

export default HabitCompanionCard;
