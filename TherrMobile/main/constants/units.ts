/**
 * Unit conversions, kept in their own leaf module rather than in `constants/index.tsx`.
 *
 * That barrel imports `@notifee/react-native` at module load, which throws outside a real
 * native runtime — so anything a pure, unit-tested utility needs (e.g. `utilities/feedRanking`)
 * has to live somewhere that pulls in no native module. `constants/index.tsx` re-exports this
 * file, so the map screens can keep importing from the barrel as before.
 */

// Miles <-> meters. Defined once because the map code converts in both directions in several
// places, and a hand-typed copy is how `1069.344` once got into the preview-card distance math
// and silently mis-sorted the strip.
export const METERS_PER_MILE = 1609.34;
