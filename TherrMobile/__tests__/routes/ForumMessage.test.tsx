import 'react-native';
import React from 'react';

// Note: test renderer must be required after react-native.
import renderer, { act } from 'react-test-renderer';

// Note: import explicitly to use the types shipped with jest.
import { it, describe, expect } from '@jest/globals';

import ForumMessage from '../../main/routes/Groups/ForumMessage';
import { buildStyles } from '../../main/styles';
import { buildStyles as buildChatStyles } from '../../main/styles/user-content/groups/view-group';

const theme = buildStyles('light');
const themeChat = buildChatStyles('light');
const translate = (key: string) => key;

const render = async (item: any, fromUserDetails: any = { id: 'other-1', userName: 'alex' }) => {
    let component: renderer.ReactTestRenderer;
    await act(async () => {
        component = renderer.create(
            <ForumMessage
                item={{ time: '11/19/26, 9:00am', ...item }}
                theme={theme}
                themeChat={themeChat}
                translate={translate}
                userDetails={{ id: 'me' }}
                fromUserDetails={fromUserDetails}
                goToUser={jest.fn()}
            />
        );
        await Promise.resolve();
    });
    return component!;
};

const flatStyle = (style: any) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));
const findBubble = (component: renderer.ReactTestRenderer) => component.root.findAll(
    (node) => typeof node.type === 'string' && node.type === 'View' && flatStyle(node.props.style).borderRadius === 18
)[0];

describe('ForumMessage', () => {
    it('renders the viewer\'s own message as a brand-colored bubble with no sender name', async () => {
        const component = await render({ fromUserId: 'me', fromUserName: 'you', text: 'hello' });
        const bubble = flatStyle(findBubble(component).props.style);

        expect(bubble.backgroundColor).toBe(theme.colors.brand);
        expect(component.root.findAll((node) => node.props?.children === 'you')).toHaveLength(0);
    });

    it('renders someone else\'s message with their name in a color that does not change between renders', async () => {
        const first = await render({ fromUserId: 'other-1', fromUserName: 'alex', text: 'hi' });
        const second = await render({ fromUserId: 'other-1', fromUserName: 'alex', text: 'again' });
        const nameColor = (component: renderer.ReactTestRenderer) => flatStyle(
            component.root.findAll((node) => typeof node.type === 'string' && node.type === 'Text' && node.props.children === 'alex')[0].props.style
        ).color;

        expect(flatStyle(findBubble(first).props.style).backgroundColor).toBe(theme.colors.surfaceAlt);
        expect(nameColor(first)).toBe(nameColor(second));
    });

    it('does not treat a sender named "Youssef" as the viewer', async () => {
        const component = await render({ fromUserName: 'Youssef', text: 'salut' }, { userName: 'Youssef' });

        expect(flatStyle(findBubble(component).props.style).backgroundColor).toBe(theme.colors.surfaceAlt);
    });

    it('renders an announcement as a caption, not a bubble', async () => {
        const component = await render({ isAnnouncement: true, text: 'alex joined the room' });

        expect(findBubble(component)).toBeUndefined();
    });
});
