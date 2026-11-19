import 'react-native';
import React from 'react';
import { Provider } from 'react-redux';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import GroupTile from '../../main/routes/Groups/GroupTile';
import { buildStyles } from '../../main/styles';
import { buildStyles as buildTileStyles } from '../../main/styles/user-content/groups/chat-tiles';

const mockStore = {
    getState: () => ({ user: { settings: { mobileThemeName: 'light' } } }),
    subscribe: () => () => {},
    dispatch: () => {},
};

const translate = (key: string, params?: any) => (params ? `${key}:${JSON.stringify(params)}` : key);
const theme = buildStyles('light');
const themeChatTile = buildTileStyles('light');

const baseGroup = {
    id: 'group-1',
    title: 'Foodies International',
    description: 'Connect with other foodies.',
    memberCount: 24,
    authorId: 'author-1',
    author: { media: { profilePicture: { path: 'author.jpg' } } },
    categories: [
        { tag: 'food', name: 'food', iconGroup: 'font-awesome-5', iconId: 'utensils', iconColor: '#143b54' },
        { tag: 'general', name: 'general', iconGroup: 'font-awesome-5', iconId: 'star', iconColor: '#ffc269' },
        { tag: 'tech', name: 'tech', iconGroup: 'font-awesome-5', iconId: 'rocket', iconColor: '#f9ad2a' },
    ],
};

const render = async (overrides: any = {}) => {
    const props = {
        group: baseGroup,
        onChatTilePress: jest.fn(),
        handleJoinGroup: jest.fn(),
        theme,
        themeChatTile,
        translate,
        user: { myUserGroups: {} },
        ...overrides,
    };
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <Provider store={mockStore as any}>
                <GroupTile {...props} />
            </Provider>
        );
        await Promise.resolve();
    });
    return component!;
};

const allText = (component: renderer.ReactTestRenderer) => component.root
    .findAll((node) => typeof node.type === 'string' && node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));

describe('GroupTile', () => {
    it('shows a lettered avatar instead of the author photo when the group has no image', async () => {
        const component = await render();
        const images = component.root.findAll((node) => node.props?.source?.uri !== undefined);

        expect(images).toHaveLength(0);
        expect(allText(component)).toContain('F');
    });

    it('combines member count and location into one meta line', async () => {
        const component = await render({ group: { ...baseGroup, city: 'Austin', region: 'TX' } });

        expect(allText(component)).toContain('pages.groups.labels.memberCount:{"count":24} · Austin, TX');
    });

    it('uses the singular member label for one member', async () => {
        const component = await render({ group: { ...baseGroup, memberCount: 1 } });

        expect(allText(component)).toContain('pages.groups.labels.memberCountOne');
    });

    it('labels at most two category chips and collapses the rest into +N', async () => {
        const component = await render();
        const text = allText(component);

        expect(text).toContain('Food');
        expect(text).toContain('General');
        expect(text).not.toContain('Tech');
        expect(text).toContain('+1');
    });

    it('offers Join to a non-member and calls the handler', async () => {
        const handleJoinGroup = jest.fn();
        const component = await render({ handleJoinGroup });
        const joinButtons = component.root.findAll(
            (node) => node.props?.title === 'menus.connections.buttons.join' && typeof node.props?.onPress === 'function'
        );

        expect(joinButtons.length).toBeGreaterThan(0);
        await act(async () => {
            joinButtons[0].props.onPress();
        });
        expect(handleJoinGroup).toHaveBeenCalledWith(baseGroup);
    });

    it('marks a joined group as Joined only where the list asks for it', async () => {
        const user = { myUserGroups: { 'group-1': { status: 'approved' } } };

        const discover = await render({ user, isJoinedLabelShown: true });
        expect(allText(discover)).toContain('pages.groups.labels.joined');
        expect(allText(discover)).not.toContain('menus.connections.buttons.join');

        const yourGroups = await render({ user });
        expect(allText(yourGroups)).not.toContain('pages.groups.labels.joined');
    });
});
