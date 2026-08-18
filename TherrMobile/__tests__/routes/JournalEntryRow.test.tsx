import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect, jest } from '@jest/globals';

import JournalEntryRow from '../../main/routes/Journal/JournalEntryRow';
import { buildStyles as buildJournalStyles } from '../../main/styles/habits/journal';

const themeJournal = buildJournalStyles('light') as any;

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

const render = (props: any) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <JournalEntryRow
                item={buildItem()}
                locale="en-us"
                themeJournal={themeJournal}
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
