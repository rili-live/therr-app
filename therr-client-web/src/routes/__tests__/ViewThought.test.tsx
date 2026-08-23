/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

const mockReduxState: any = {
    user: {
        isAuthenticated: true,
        details: { id: 'viewer-1', userName: 'viewer' },
        settings: { locale: 'en-us' },
    },
    content: { activeThoughts: [] },
};

jest.mock('react-redux', () => ({
    // The component dispatches thunks and reads the response as a promise, so an identity
    // dispatch is enough — the actions themselves are mocked below.
    useDispatch: () => (action: any) => action,
    useSelector: (selector: any) => selector(mockReduxState),
}));

jest.mock('therr-react/redux/actions', () => ({
    ContentActions: {
        createOrUpdateThoughtReaction: jest.fn(),
    },
}));

jest.mock('therr-react/services', () => ({
    ReactionsService: {
        getThoughtReactions: jest.fn().mockResolvedValue({ data: [] }),
    },
}));

jest.mock('therr-react/components', () => ({
    InlineSvg: () => null,
}));

// ViewThought reaches this through the repost embed. It reads globalConfig at module scope,
// which is not resolvable under the test NODE_ENV — same reason ViewUser.test.tsx mocks it.
jest.mock('../../utilities/getUserImageUri', () => ({
    __esModule: true,
    default: () => 'https://example.com/image.jpg',
}));

const mockGetThoughtDetails = jest.fn();

jest.mock('../../redux/actions/UsersActions', () => ({
    __esModule: true,
    default: {
        getThoughtDetails: (...args: any[]) => mockGetThoughtDetails(...args),
        createThought: jest.fn(),
    },
}));

import * as React from 'react';
import { mount, ReactWrapper } from 'enzyme';
import { act } from 'react-test-renderer';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ViewThought from '../ViewThought';

const PARENT_ID = 'thought-parent-1';

const rootThought = {
    id: 'thought-1',
    fromUserId: 'author-1',
    fromUserName: 'author',
    message: 'the original thought',
    createdAt: new Date().toISOString(),
    replies: [],
};

const replyThought = {
    id: 'thought-2',
    parentId: PARENT_ID,
    fromUserId: 'author-2',
    fromUserName: 'replier',
    message: 'a reply to the original',
    createdAt: new Date().toISOString(),
    replies: [],
    parent: {
        id: PARENT_ID,
        fromUserId: 'author-1',
        fromUserName: 'author',
        message: 'the original thought',
    },
};

const mountViewThought = async (thought: any) => {
    mockGetThoughtDetails.mockResolvedValue({ thought });

    let wrapper: ReactWrapper = null as any;

    await act(async () => {
        wrapper = mount(
            <MantineProvider>
                <MemoryRouter initialEntries={[`/thoughts/${thought.id}`]}>
                    <Routes>
                        <Route path="/thoughts/:thoughtId" element={<ViewThought />} />
                    </Routes>
                </MemoryRouter>
            </MantineProvider>,
        );
    });
    wrapper.update();

    return wrapper;
};

describe('ViewThought thread context', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('requests the parent thought alongside the details', async () => {
        await mountViewThought(rootThought);

        expect(mockGetThoughtDetails).toHaveBeenCalledWith(
            rootThought.id,
            expect.objectContaining({ withParent: true }),
        );
    });

    it('names the parent author and links up to the parent when the post is a reply', async () => {
        const wrapper = await mountViewThought(replyThought);

        expect(wrapper.text()).toContain('Replying to author');
        expect(wrapper.find(`a[href="/thoughts/${PARENT_ID}"]`).length).toBeGreaterThan(0);
    });

    it('quotes the parent message so the reply is readable in context', async () => {
        const wrapper = await mountViewThought(replyThought);

        expect(wrapper.text()).toContain('the original thought');
    });

    it('offers a way back to the thread instead of only back to the feed', async () => {
        const wrapper = await mountViewThought(replyThought);

        expect(wrapper.text()).toContain('Back to Thread');
    });

    it('shows no thread context on a top-level thought', async () => {
        const wrapper = await mountViewThought(rootThought);

        expect(wrapper.text()).not.toContain('Replying to');
        expect(wrapper.text()).not.toContain('Back to Thread');
    });

    it('falls back to generic wording when the parent author is unknown', async () => {
        const wrapper = await mountViewThought({
            ...replyThought,
            parent: { id: PARENT_ID, message: 'the original thought' },
        });

        expect(wrapper.text()).toContain('Part of a thread');
        expect(wrapper.find(`a[href="/thoughts/${PARENT_ID}"]`).length).toBeGreaterThan(0);
    });
});
