import { Platform } from 'react-native';

/**
 * The value every mobile request sends as its `x-platform` header.
 *
 * Both call sites (`interceptors.ts` and `components/Layout.tsx`) used to send the
 * literal string 'mobile', which made a user's iOS and Android installs
 * indistinguishable to the backend. That matters because `main.userDeviceTokens` is
 * keyed UNIQUE (userId, brandVariation, platform): two devices under one brand
 * collapsed onto a single row, so the second device's registration overwrote the
 * first and only the most recently opened device could receive a push.
 *
 * `Platform.OS` is 'ios' | 'android' on this target, matching the values the
 * `20260425000003_main.userDeviceTokens` migration documents. The backend still
 * accepts the legacy 'mobile' value from installs that predate this change — see
 * `normalizePlatform` in users-service/src/utilities/syncDeviceTokenForBrand.ts.
 */
const REQUEST_PLATFORM: string = Platform.OS;

export default REQUEST_PLATFORM;
