/**
 * Coordinate guards for the map path.
 *
 * A leaf module with no native imports, for the same reason `constants/units.ts` is one:
 * `constants/index.tsx` pulls in `@notifee/react-native` at module load, which throws
 * outside a real native runtime, so anything a unit-tested utility needs has to live
 * somewhere that imports nothing native.
 *
 * `Number.isFinite` rather than a truthiness check, because `0` is a real latitude and a
 * real longitude — the equator, and the prime meridian through the UK, France, Spain and
 * Ghana. `a.latitude && a.longitude` silently drops those areas, which is the bug
 * `utilities/lastMapLocation` was already fixed for; the map preview strip kept its own
 * copy of the same check. `isFinite` also rejects undefined, null, NaN, Infinity, and the
 * strings a malformed API payload can carry.
 */
export const isUsableCoordinate = (value: any): value is number => Number.isFinite(value);

/** Whether a point carries a latitude and longitude the map can actually use. */
export const hasUsableCoords = (point: any): boolean => isUsableCoordinate(point?.latitude)
    && isUsableCoordinate(point?.longitude);

export default hasUsableCoords;
