// Cross-app handoff: short-lived single-use code → user/brand binding.
//
// Defined here (rather than in users-service) so any service that participates in the handoff
// flow — today: api-gateway proxies, users-service mints/redeems/cancels — can share the same
// shape. Two divergent copies got us into trouble during peer review (the gateway's IHandoffEntry
// was missing `issuedAt`); centralizing here prevents recurrence.
export interface IHandoffEntry {
    userId: string;
    sourceBrand: string;
    targetBrand: string;
    deviceFingerprint?: string;
    // Wall-clock millis when the code was minted. Pure-informational on the redeem side
    // (TTL is enforced by Redis EXPIRE), but useful for diagnosis when a handoff fails after
    // a long pause between mint and redeem.
    issuedAt: number;
}
