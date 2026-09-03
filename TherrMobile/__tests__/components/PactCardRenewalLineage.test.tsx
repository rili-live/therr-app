import { it, describe, expect, jest } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

jest.mock('react-native-vector-icons/FontAwesome5', () => ({
    __esModule: true,
    default: () => null,
}));

// Imported after the mock, as PactStatusText.test.ts does: the card pulls in
// react-native-vector-icons at module scope, which has no native module under Jest.
import PactCard from '../../main/components/Habits/PactCard';

/**
 * Renewal lineage on the pact card.
 *
 * "Re-commit for 30 days" creates a *new* pact on the same habit goal rather than
 * extending the old row, and the finished cycle keeps its own dates, completion rates
 * and history. That is the right storage model, but it used to reach the user as two
 * pacts where they had one habit — and each further tap of the still-live CTA added
 * another, because nothing about the finished cycle changed when it was continued.
 *
 * Three things have to hold on the card for a renewal to read as a continuation:
 *
 *   1. A continued cycle stops offering to be continued again.
 *   2. A cycle that continues an earlier one says so, and can reach it — the list
 *      leaves superseded cycles out, so the link is the only route to the history.
 *   3. Following that link opens the pact it names, not the card it sits on.
 */

const themeHabits: any = {
    colors: {
        alertSuccess: '#0a0',
        alertWarning: '#fa0',
        onSurfaceMuted: '#888',
        onBrand: '#fff',
        textGray: '#666',
    },
    // Every style the card reads, as an identity map: these assertions are about
    // structure and handlers, and a real StyleSheet would only add a native dependency.
    styles: new Proxy({}, { get: (_target, key) => ({ styleKey: key }) }),
};

const translate = (key: string, params?: any) => (params
    ? `${key}:${JSON.stringify(params)}`
    : key);

const basePact: any = {
    id: 'pact-2',
    creatorUserId: 'me',
    habitGoalId: 'goal-1',
    habitGoalName: 'Morning run',
    pactType: 'accountability',
    status: 'active',
    durationDays: 30,
    members: [],
};

const render = (pact: any, props: any = {}) => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
        tree = renderer.create(
            <PactCard
                pact={pact}
                currentUserId="me"
                themeHabits={themeHabits}
                translate={translate}
                {...props}
            />,
        );
    });
    return tree as renderer.ReactTestRenderer;
};

const textContents = (tree: renderer.ReactTestRenderer): string[] => tree.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((child): child is string => typeof child === 'string');

/**
 * The tappable lineage rows, found by props rather than by component type.
 *
 * `Pressable` renders a host View that carries the same `accessibilityLabel`, and
 * TherrMobile's Babel `resolvePath` sends `react-native` imports through
 * `resolver/react-native/`, so an identity check against the imported symbol does not
 * hold either. `onPress` is on the composite alone, which makes it the reliable
 * discriminator.
 */
const lineageLinks = (tree: renderer.ReactTestRenderer) => tree.root.findAll((node) => (
    typeof node.props?.accessibilityLabel === 'string'
    && node.props.accessibilityLabel.startsWith('pages.pacts.renew.')
    && typeof node.props?.onPress === 'function'
));

describe('PactCard renewal lineage', () => {
    it('hides the re-commit CTA on a cycle that has already been continued', () => {
        const onRenew = jest.fn();
        const tree = render({
            ...basePact,
            status: 'expired',
            endDate: '2020-01-01T00:00:00.000Z',
            supersededByPactId: 'pact-3',
        }, { onRenew });

        expect(textContents(tree)).not.toContain('pages.pacts.renew.prompt');
    });

    it('still offers the CTA on a finished cycle nothing has continued', () => {
        const tree = render({
            ...basePact,
            status: 'expired',
            endDate: '2020-01-01T00:00:00.000Z',
        }, { onRenew: jest.fn() });

        expect(textContents(tree)).toContain('pages.pacts.renew.prompt');
    });

    it('links back to the cycle a renewal continues', () => {
        const onViewSourcePact = jest.fn();
        const tree = render(
            { ...basePact, renewedFromPactId: 'pact-1', renewalCycleNumber: 2 },
            { onViewSourcePact },
        );

        const [link] = lineageLinks(tree);
        expect(link?.props.accessibilityLabel).toBe('pages.pacts.renew.extendedFrom');

        // stopPropagation matters as much as the handler: the whole card is a Pressable
        // that opens this pact, so a tap that bubbled would open the successor the user
        // is already looking at instead of the history they asked for.
        const stopPropagation = jest.fn();
        act(() => {
            link.props.onPress({ stopPropagation });
        });
        expect(onViewSourcePact).toHaveBeenCalledWith('pact-1');
        expect(stopPropagation).toHaveBeenCalled();
    });

    it('links forward from a superseded cycle to the one that replaced it', () => {
        const onViewSuccessorPact = jest.fn();
        const onViewSourcePact = jest.fn();
        const tree = render({
            ...basePact,
            status: 'expired',
            renewedFromPactId: 'pact-1',
            supersededByPactId: 'pact-3',
        }, { onViewSuccessorPact, onViewSourcePact });

        // A middle cycle has a link in both directions and the card draws one. Forward
        // wins: it answers "so where is my habit now".
        const links = lineageLinks(tree);
        expect(links).toHaveLength(1);

        act(() => {
            links[0].props.onPress({ stopPropagation: jest.fn() });
        });
        expect(onViewSuccessorPact).toHaveBeenCalledWith('pact-3');
        expect(onViewSourcePact).not.toHaveBeenCalled();
    });

    it('states the relationship without a handler rather than drawing a dead link', () => {
        const tree = render({ ...basePact, renewedFromPactId: 'pact-1' });

        expect(textContents(tree)).toContain('pages.pacts.renew.extendedFrom');
        expect(lineageLinks(tree)).toHaveLength(0);
    });

    it('badges the cycle count from the second cycle on, never the first', () => {
        expect(textContents(render({ ...basePact, renewalCycleNumber: 3 })))
            .toContain('pages.pacts.renew.cycleLabel:{"number":3}');
        expect(textContents(render({ ...basePact, renewalCycleNumber: 1 })).join(' '))
            .not.toContain('cycleLabel');
        // Legacy rows predate the column and are first cycles as far as anything knows.
        expect(textContents(render(basePact)).join(' ')).not.toContain('cycleLabel');
    });
});
