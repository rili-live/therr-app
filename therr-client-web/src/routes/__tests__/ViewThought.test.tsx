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

// `getUserContentUri` reads `globalConfig[process.env.NODE_ENV]` at module load, and
// global-config.js declares no `test` env — so importing it at all throws here. Mocked
// the same way ListSpaces and ViewSpace mock it. ViewThought reaches it transitively
// through `getThoughtMediaUri`, which renders a thought's attached image.
jest.mock('../../utilities/getUserContentUri', () => ({
    __esModule: true,
    default: () => 'https://example.com/image.jpg',
}));

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

/**
 * The server refuses to repost a non-public thought unless the requester wrote it
 * (handlers/thoughts createThought → 403 THOUGHT_ACCESS_RESTRICTED). Clients mint every reply
 * with isPublic=false, so a control offered on all of them fails for anyone but the author —
 * and the client maps that 403 onto copy that asks the user to try again.
 */
describe('ViewThought repost control visibility', () => {
    const findRepostButtons = (wrapper: ReactWrapper) => wrapper.find('button[aria-label="Repost"]');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('offers no repost control on a non-public thought written by somebody else', async () => {
        const wrapper = await mountViewThought({
            ...rootThought,
            isPublic: false,
        });

        expect(findRepostButtons(wrapper).length).toBe(0);
    });

    it('offers a repost control on a non-public thought the viewer wrote themselves', async () => {
        const wrapper = await mountViewThought({
            ...rootThought,
            fromUserId: 'viewer-1',
            isPublic: false,
        });

        expect(findRepostButtons(wrapper).length).toBeGreaterThan(0);
    });

    it('offers a repost control on a public thought written by somebody else', async () => {
        const wrapper = await mountViewThought({
            ...rootThought,
            isPublic: true,
        });

        expect(findRepostButtons(wrapper).length).toBeGreaterThan(0);
    });

    it('offers no repost control on another user\'s reply in the thread', async () => {
        const wrapper = await mountViewThought({
            ...rootThought,
            isPublic: true,
            replies: [{
                id: 'reply-1',
                parentId: rootThought.id,
                fromUserId: 'author-2',
                fromUserName: 'replier',
                message: 'a reply nobody may repost',
                createdAt: new Date().toISOString(),
                isPublic: false,
            }],
        });

        // Only the root thought's own control, never the reply's.
        expect(findRepostButtons(wrapper).length).toBe(1);
    });

    it('offers no repost control on a thought that is already a repost', async () => {
        const wrapper = await mountViewThought({
            ...rootThought,
            isPublic: true,
            isRepost: true,
            repostOf: null,
        });

        expect(findRepostButtons(wrapper).length).toBe(0);
    });
});
