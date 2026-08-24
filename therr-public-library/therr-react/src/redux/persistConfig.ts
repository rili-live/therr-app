import { createTransform, Transform } from 'redux-persist';

/**
 * Strip `user.userInView` on the way into storage.
 *
 * `userInView` is the profile currently being *looked at*, not anything about the
 * signed-in user, so persisting it means the next cold start rehydrates a stale
 * profile — and both platforms render it before their own fetch resolves. Web's
 * `ViewUser.render()` reads `user.userInView` unconditionally, and mobile's
 * `HeaderMenuRight` reads `user.userInView.connectionType` to draw the connection
 * tier, so a profile from a previous session flashes over the one just navigated to,
 * carrying its connection status with it.
 *
 * Every screen that reads it already fetches on mount, so there is nothing to keep.
 * Dropping it inbound (rather than blacklisting the whole `user` slice) preserves
 * `details` / `settings` / `socketDetails`, which do need to survive a reload.
 *
 * Pinned to `Transform<any, any, any, any>` because this transform is state-agnostic —
 * it keys off the slice name, not the shape of the store. See the note on
 * `basePersistConfig.transforms` for why the config field then has to widen further.
 */
const stripUserInView: Transform<any, any, any, any> = createTransform(
    (inboundState: any, key) => {
        if (key !== 'user' || !inboundState || typeof inboundState !== 'object') {
            return inboundState;
        }

        const persisted = { ...inboundState };
        delete persisted.userInView;

        return persisted;
    },
    (outboundState) => outboundState,
    { whitelist: ['user'] },
);

/**
 * Shared redux-persist configuration.
 *
 * Each platform (mobile/web) wraps the root reducer with `persistReducer`
 * using this config merged with a platform-specific `storage` adapter.
 *
 * Only read-heavy, user-relevant slices are persisted.
 * Transient slices (map, messages, reactions, routing) are excluded.
 */
const basePersistConfig = {
    key: 'therr-root',
    version: 1,
    // Coalesce writes so action bursts (map searches, socket events, feed
    // refreshes) don't each trigger a full slice serialization into storage.
    // Trade-off: up to `throttle` ms of unpersisted state on hard-kill.
    throttle: 1000,
    whitelist: [
        'user',
        'content',
        'notifications',
        'userConnections',
    ],
    // Widened to `any[]` on purpose; the transform itself stays fully typed above.
    //
    // `PersistConfig<S>` declares `transforms: Array<Transform<HSS, ESS, S, RS>>`, which
    // makes this field an inference site for `S` in every consumer's
    // `persistReducer(config, rootReducer)` call. Its mere presence — even pinned to
    // `Transform<any, any, any, any>` — is enough to tip inference away from the reducer's
    // own state: redux's `combineReducers` returns `Reducer<S, A, Partial<S>>`, and with a
    // `transforms` key in play TS resolves `S` to `Partial<RootState>` and then rejects the
    // root reducer it was inferred from. Mobile's `getStore.tsx` fails to compile without
    // this widening (web's store happens not to, but is subject to the same rule).
    transforms: [stripUserInView] as any[],
};

export default basePersistConfig;
