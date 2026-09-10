import basePersistConfig from '../persistConfig';

/**
 * Compile-time guard, checked by `npm run pr:typecheck:therr-react` in CI.
 *
 * `PersistConfig<S>` declares `transforms: Array<Transform<HSS, ESS, S, RS>>`, which makes
 * the field an inference site for `S` at every `persistReducer(config, rootReducer)` call.
 * Declaring it with any `Transform`-shaped type — even pinned to `Transform<any, any, any,
 * any>` — tips TS into resolving `S` to the `Partial<S>` preloaded-state slot that redux's
 * `combineReducers` reports, and it then rejects the very reducer it inferred from. Mobile's
 * `getStore.tsx` stopped compiling on exactly that, so `persistConfig` widens the field to
 * `any[]`.
 *
 * This has to be an assertion about the *type* rather than a `persistReducer` call, because
 * the failure only surfaces under `strict` — which mobile sets and this package does not.
 * And nothing else catches it: CI type-checks web and dashboard (whose stores happen to
 * infer cleanly) but has no mobile typecheck job, so a regression here would reach a build
 * machine before a human.
 */
type IsAny<T> = 0 extends (1 & T) ? true : false;
const transformsMustStayUntyped: IsAny<(typeof basePersistConfig.transforms)[number]> = true;

describe('basePersistConfig', () => {
    const [stripUserInView] = basePersistConfig.transforms;

    // redux-persist calls transforms as `in(state, key, fullState)` per whitelisted slice.
    const persist = (key: string, state: any) => (stripUserInView as any).in(state, key, {});
    const rehydrate = (key: string, state: any) => (stripUserInView as any).out(state, key, {});

    it('persists exactly the slices both platforms rehydrate', () => {
        expect(basePersistConfig.whitelist).toEqual(['user', 'content', 'notifications', 'userConnections']);
    });

    describe('userInView', () => {
        it('is dropped from the user slice on the way into storage', () => {
            // The regression: a profile from a previous session rehydrates and both
            // platforms render it — with its connection status — before their own
            // fetch for the profile actually navigated to resolves.
            const persisted = persist('user', {
                details: { id: 'me' },
                isAuthenticated: true,
                userInView: { id: 'someone-else', isNotConnected: false, connectionType: 3 },
            });

            expect(persisted).not.toHaveProperty('userInView');
        });

        it('leaves the rest of the user slice intact', () => {
            const persisted = persist('user', {
                details: { id: 'me' },
                isAuthenticated: true,
                settings: { locale: 'fr-ca' },
                socketDetails: { session: { token: 'abc' } },
                userInView: { id: 'someone-else' },
            });

            expect(persisted).toEqual({
                details: { id: 'me' },
                isAuthenticated: true,
                settings: { locale: 'fr-ca' },
                socketDetails: { session: { token: 'abc' } },
            });
        });

        it('does not mutate the live redux state it was handed', () => {
            const liveState = { details: { id: 'me' }, userInView: { id: 'someone-else' } };

            persist('user', liveState);

            expect(liveState.userInView).toEqual({ id: 'someone-else' });
        });
    });

    it('leaves other whitelisted slices untouched', () => {
        const content = { activeMoments: [{ id: '1' }], userInView: 'not-a-user-slice-key' };

        expect(persist('content', content)).toBe(content);
    });

    it('tolerates a null or non-object slice', () => {
        expect(persist('user', null)).toBeNull();
        expect(persist('user', undefined)).toBeUndefined();
    });

    it('rehydrates whatever is in storage without alteration', () => {
        const stored = { details: { id: 'me' }, isAuthenticated: true };

        expect(rehydrate('user', stored)).toBe(stored);
    });

    // Keeps the compile-time guard above from being dropped as unused.
    it('keeps `transforms` un-generic so it cannot constrain a consumer store type', () => {
        expect(transformsMustStayUntyped).toBe(true);
    });
});
