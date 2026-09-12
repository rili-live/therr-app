import 'react-native';
import React from 'react';
import { Text } from 'react-native';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

import {
    it, describe, expect, jest,
} from '@jest/globals';

/**
 * The check-in commits on the first tap and the proof sheet is only offered from
 * the transient success toast. Once a habit is completed, CheckinButton keeps a
 * standing "add a note or photo" action so a missed or accidentally-dismissed
 * sheet is not a dead end. It must appear only after completion and only when a
 * handler is wired.
 */

import CheckinButton from '../../main/components/Habits/CheckinButton';
import { buildStyles as buildHabitStyles } from '../../main/styles/habits';

const themeHabits = buildHabitStyles('light');

const ADD_DETAIL_TITLE = 'Add a note or photo';

const findAddDetail = (component: renderer.ReactTestRenderer) => component.root
    .findAllByType(Text)
    .find((t) => t.props.children === ADD_DETAIL_TITLE);

const render = (props: any = {}) => {
    let component: renderer.ReactTestRenderer;
    act(() => {
        component = renderer.create(
            <CheckinButton
                onPress={jest.fn()}
                title="Check In"
                completedTitle="Completed!"
                themeHabits={themeHabits as any}
                {...props}
            />,
        );
    });
    return component!;
};

const pressAddDetail = (component: renderer.ReactTestRenderer) => {
    let node: renderer.ReactTestInstance | null = findAddDetail(component) || null;
    while (node && typeof node.props.onPress !== 'function') {
        node = node.parent;
    }
    if (!node) {
        throw new Error('No pressable add-detail action');
    }
    act(() => {
        node!.props.onPress();
    });
};

describe('CheckinButton — add-detail action', () => {
    it('does not render the add-detail action before the habit is completed', () => {
        const component = render({
            isCompleted: false,
            onAddDetail: jest.fn(),
            addDetailTitle: ADD_DETAIL_TITLE,
        });

        expect(findAddDetail(component)).toBeUndefined();
    });

    it('does not render the add-detail action when no handler is wired, even if completed', () => {
        const component = render({
            isCompleted: true,
            addDetailTitle: ADD_DETAIL_TITLE,
        });

        expect(findAddDetail(component)).toBeUndefined();
    });

    it('renders the add-detail action once completed and invokes the handler when pressed', () => {
        const onAddDetail = jest.fn();
        const component = render({
            isCompleted: true,
            onAddDetail,
            addDetailTitle: ADD_DETAIL_TITLE,
        });

        expect(findAddDetail(component)).toBeDefined();

        pressAddDetail(component);

        expect(onAddDetail).toHaveBeenCalledTimes(1);
    });
});
