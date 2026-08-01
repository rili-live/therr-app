import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';

import { IdentityStages } from 'therr-js-utilities/config';
import IdentityCard from '../../main/components/Habits/IdentityCard';
import { buildStyles as buildHabitStyles } from '../../main/styles/habits';

/**
 * IdentityCard renders the habit -> mindset -> identity ladder.
 *
 * The behaviors worth pinning down are the ones that make the card different
 * from the streak widget sitting under it: the vote count survives a lapse, the
 * dormant copy never scolds, and only ONE next step is shown.
 */

const themeHabits = buildHabitStyles('light');

// Echo the key so assertions can check which string was chosen without coupling
// to copy, and append params so interpolation is observable.
const translate = (key: string, params?: any) => (params
    ? `${key}|${JSON.stringify(params)}`
    : key);

const collectText = (json: any): string[] => {
    if (json == null) {
        return [];
    }
    if (typeof json === 'string') {
        return [json];
    }
    if (Array.isArray(json)) {
        return json.flatMap(collectText);
    }
    return collectText(json.children);
};

const renderCard = (snapshot: any) => {
    let tree: any;
    act(() => {
        tree = renderer.create(
            <IdentityCard
                snapshot={snapshot}
                onNameIdentity={jest.fn()}
                themeHabits={themeHabits}
                translate={translate}
            />,
        );
    });
    return collectText(tree.toJSON()).join(' ');
};

const buildSnapshot = (overrides: any = {}) => ({
    progress: {
        id: 'ip1',
        habitGoalId: 'g1',
        identityLabel: 'someone who runs before work',
        stage: IdentityStages.REPETITION,
        votesCast: 12,
        ...overrides.progress,
    },
    evaluation: {
        stage: IdentityStages.REPETITION,
        stageKey: 'repetition',
        nextStage: IdentityStages.AUTOMATICITY,
        nextStageKey: 'automaticity',
        progressToNextStage: 45,
        requirements: [],
        unmetRequirements: [],
        ...overrides.evaluation,
    },
    isDormant: false,
    daysSinceLastVote: 0,
    ...overrides.rest,
});

describe('IdentityCard', () => {
    it('prompts the user to name an identity when there is none', () => {
        const text = renderCard(null);
        expect(text).toContain('pages.habits.identity.unnamedPrompt');
        expect(text).toContain('pages.habits.identity.nameItCta');
    });

    it('renders the identity statement and offers to change it once named', () => {
        const text = renderCard(buildSnapshot());
        expect(text).toContain('someone who runs before work');
        expect(text).toContain('pages.habits.identity.editLabelCta');
        expect(text).not.toContain('pages.habits.identity.nameItCta');
    });

    it('renders the stage copy for the evaluated stage', () => {
        const text = renderCard(buildSnapshot());
        expect(text).toContain('pages.habits.identity.stages.repetition.title');
        expect(text).toContain('pages.habits.identity.stages.repetition.blurb');
    });

    it('uses singular vote copy for a single check-in', () => {
        const text = renderCard(buildSnapshot({ progress: { votesCast: 1 } }));
        expect(text).toContain('pages.habits.identity.voteSingular');
        expect(text).not.toContain('pages.habits.identity.votePlural');
    });

    it('hides the vote line entirely before the first check-in', () => {
        const text = renderCard(buildSnapshot({ progress: { votesCast: 0 } }));
        expect(text).not.toContain('pages.habits.identity.voteSingular');
        expect(text).not.toContain('pages.habits.identity.votePlural');
    });

    it('shows only the nearest unmet requirement, not the whole checklist', () => {
        // `unmetRequirements` arrives worst-progress first, so the LAST entry is
        // the one closest to done — the actionable next step.
        const text = renderCard(buildSnapshot({
            evaluation: {
                unmetRequirements: [
                    {
                        key: 'consistencyRatio', comparison: 'gte', threshold: 0.6, actual: 0.1, isMet: false, progress: 0.16,
                    },
                    {
                        key: 'votesCast', comparison: 'gte', threshold: 21, actual: 18, isMet: false, progress: 0.85,
                    },
                ],
            },
        }));
        expect(text).toContain('pages.habits.identity.next.votesCast');
        expect(text).not.toContain('pages.habits.identity.next.consistencyRatio');
    });

    it('passes a whole-number remaining count to the next-step copy', () => {
        const text = renderCard(buildSnapshot({
            evaluation: {
                unmetRequirements: [{
                    key: 'votesCast', comparison: 'gte', threshold: 21, actual: 18, isMet: false, progress: 0.85,
                }],
            },
        }));
        expect(text).toContain('"remaining":3');
    });

    it('renders ratio requirements as percentages rather than raw ratios', () => {
        const text = renderCard(buildSnapshot({
            evaluation: {
                unmetRequirements: [{
                    key: 'consistencyRatio', comparison: 'gte', threshold: 0.6, actual: 0.45, isMet: false, progress: 0.75,
                }],
            },
        }));
        expect(text).toContain('"thresholdPercent":60');
        expect(text).toContain('"actualPercent":45');
    });

    it('keeps the vote count visible while dormant, and frames the gap as a return', () => {
        // The point of the card: a lapse costs a streak, not an identity.
        const text = renderCard(buildSnapshot({
            rest: { isDormant: true, daysSinceLastVote: 30 },
        }));
        expect(text).toContain('pages.habits.identity.dormant');
        expect(text).toContain('12');
        expect(text).toContain('pages.habits.identity.stages.repetition.title');
    });

    it('drops the next-step hint and percentage at the top of the ladder', () => {
        const text = renderCard(buildSnapshot({
            progress: { stage: IdentityStages.IDENTITY },
            evaluation: {
                stage: IdentityStages.IDENTITY,
                stageKey: 'identity',
                nextStage: null,
                nextStageKey: null,
                progressToNextStage: 100,
                unmetRequirements: [],
            },
        }));
        expect(text).toContain('pages.habits.identity.stages.identity.title');
        expect(text).not.toContain('pages.habits.identity.next.');
        expect(text).not.toContain('100%');
    });

    it('falls back to the stored stage when no evaluation was returned', () => {
        const text = renderCard({
            progress: { id: 'ip1', stage: IdentityStages.MINDSET, votesCast: 50 },
            evaluation: null,
            isDormant: false,
            daysSinceLastVote: 1,
        });
        expect(text).toContain('pages.habits.identity.stages.mindset.title');
    });
});
