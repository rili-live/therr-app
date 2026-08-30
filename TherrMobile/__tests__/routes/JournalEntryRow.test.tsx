import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';

import JournalEntryRow from '../../main/routes/Journal/JournalEntryRow';
import { buildStyles as buildJournalStyles } from '../../main/styles/habits/journal';
import {
    buildJournalSwatchAssignment,
    resolveJournalSwatch,
} from '../../main/styles/habits/journalPalette';

const themeJournal = buildJournalStyles('light') as any;

// What the screen does per row, so these render with the colors the app renders.
const swatchFor = (item: any, assignment: Record<string, number> = {}) => resolveJournalSwatch(
    item,
    themeJournal.palette,
    themeJournal.typePalette,
    assignment,
);

const translate = (key: string, params?: any) => (
    params ? `${key}(${Object.values(params).join(',')})` : key
);

const buildItem = (overrides: any = {}) => ({
    id: 'item-1',
    type: 'note',
    occurredAt: '2026-08-14T21:14:00.000Z',
    entryDate: '2026-08-14',
    body: 'Wrote something',
    habitGoalId: null,
    goalName: null,
    goalEmoji: null,
    meta: null,
    ...overrides,
}) as any;

const render = ({ assignment, ...props }: any = {}) => {
    let component: renderer.ReactTestRenderer;
    const item = props.item || buildItem();

    act(() => {
        component = renderer.create(
            <JournalEntryRow
                item={item}
                locale="en-us"
                themeJournal={themeJournal}
                swatch={swatchFor(item, assignment)}
                translate={translate as any}
                {...props}
            />,
        );
    });

    return component!;
};

const findPressables = (component: renderer.ReactTestRenderer) => component.root.findAll(
    (node) => typeof node.props?.accessibilityLabel === 'string' && node.props?.accessibilityRole === 'button',
);

/**
 * The journal row.
 *
 * A goal is a posted thought, not a note, so it opens the thought view rather
 * than the journal's composer — sending it to the composer would let a user
 * "edit" a post through a form that knows nothing about its image, replies or
 * public/private state.
 */
describe('JournalEntryRow', () => {
    it('renders a goal from the body the server sent', () => {
        const component = render({
            item: buildItem({ id: 'goal-1', type: 'goal', body: 'Run a 5k by October' }),
        });

        const text = JSON.stringify(component.toJSON());
        expect(text).toContain('Run a 5k by October');
        expect(text).toContain('pages.journal.entry.goalChip');
    });

    it('opens a goal through the goal handler, not the composer', () => {
        const onPress = jest.fn();
        const onPressGoal = jest.fn();
        const item = buildItem({ id: 'goal-1', type: 'goal' });
        const component = render({ item, onPress, onPressGoal });

        act(() => {
            findPressables(component)[0].props.onPress();
        });

        expect(onPressGoal).toHaveBeenCalledWith(item);
        expect(onPress).not.toHaveBeenCalled();
    });

    it('still sends a note to the composer', () => {
        const onPress = jest.fn();
        const onPressGoal = jest.fn();
        const item = buildItem();
        const component = render({ item, onPress, onPressGoal });

        act(() => {
            findPressables(component)[0].props.onPress();
        });

        expect(onPress).toHaveBeenCalledWith(item);
        expect(onPressGoal).not.toHaveBeenCalled();
    });

    it('leaves event rows unpressable', () => {
        // A milestone or a check-in is a record of something that happened;
        // there is nothing to open and nothing to edit.
        const component = render({
            item: buildItem({ type: 'milestone', body: null, meta: { milestoneReached: 7 } }),
            onPress: jest.fn(),
            onPressGoal: jest.fn(),
        });

        expect(findPressables(component)).toHaveLength(0);
    });

    it('does not tag a note with the goal chip', () => {
        const component = render({ item: buildItem() });

        expect(JSON.stringify(component.toJSON())).not.toContain('pages.journal.entry.goalChip');
    });
});

/**
 * Color coding.
 *
 * The point of the feature is that a user can tell two habits apart at a glance
 * on a day that mixes them, so what is worth asserting is the *contrast between
 * rows*, not any particular hex. These read the rendered tree rather than the
 * palette directly, because the failure that matters is a row that stops
 * carrying its color through to the view.
 */
const accentsOf = (component: renderer.ReactTestRenderer): string[] => component.root
    .findAll((node) => !!node.props?.style)
    .flatMap((node) => (Array.isArray(node.props.style) ? node.props.style : [node.props.style]))
    .filter((style) => !!style?.borderLeftColor && style.borderLeftColor !== 'transparent')
    .map((style) => style.borderLeftColor);

describe('JournalEntryRow color coding', () => {
    const assignment = buildJournalSwatchAssignment(['habit-a', 'habit-b']);

    it('draws two different habits in two different colors', () => {
        const a = accentsOf(render({
            item: buildItem({ habitGoalId: 'habit-a', goalName: 'Running' }),
            assignment,
        }));
        const b = accentsOf(render({
            item: buildItem({ habitGoalId: 'habit-b', goalName: 'Reading' }),
            assignment,
        }));

        expect(a[0]).toBeTruthy();
        expect(b[0]).toBeTruthy();
        expect(a[0]).not.toBe(b[0]);
    });

    it('draws every row of one habit in the same color, whatever the row type', () => {
        // A check-in, the note written about it and the milestone it produced
        // are one habit's story; splitting them across colors would undo the
        // grouping the color is there to provide.
        const checkin = accentsOf(render({
            item: buildItem({ type: 'checkin', body: null, habitGoalId: 'habit-a', goalName: 'Running' }),
            assignment,
        }));
        const milestone = accentsOf(render({
            item: buildItem({
                type: 'milestone',
                body: null,
                habitGoalId: 'habit-a',
                goalName: 'Running',
                meta: { milestoneReached: 7 },
            }),
            assignment,
        }));

        expect(checkin[0]).toBe(milestone[0]);
    });

    it('gives a habit the same color whether or not the habit list has loaded', () => {
        // The feed and the habit list are two requests; the one that arrives
        // first must not decide the color, or every row visibly re-colors when
        // the other lands.
        const item = buildItem({ habitGoalId: 'habit-a', goalName: 'Running' });

        expect(accentsOf(render({ item }))[0])
            .toBe(accentsOf(render({ item, assignment }))[0]);
    });

    it('colors a goal from the type palette rather than a habit slot', () => {
        const goal = accentsOf(render({ item: buildItem({ type: 'goal', body: 'Run a 5k' }) }));

        expect(goal[0]).toBe(themeJournal.typePalette.goal.accent);
    });

    it('leaves an untagged note neutral, so color keeps meaning "habit"', () => {
        const note = accentsOf(render({ item: buildItem() }));

        expect(note[0]).toBe(themeJournal.typePalette.neutral.accent);
    });
});
