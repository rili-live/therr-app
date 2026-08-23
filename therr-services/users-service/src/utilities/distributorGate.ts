/**
 * Minimum gap between thought distributor runs for one user.
 *
 * Env-tunable so the cadence can be adjusted against real consumption rates without a
 * deploy; 0 disables the gate. Shared by every caller that fires the distributor off the
 * back of routine client traffic (notification polls, location pings) so they draw from one
 * budget rather than each having their own — the gate is keyed per user, not per caller, so
 * two independent windows would just mean twice the runs.
 *
 * Login is deliberately NOT gated (handlers/auth.ts passes 0): a fresh session always
 * re-seeds, and passing 0 never claims the window, which is what lets the first location
 * ping after a sign-in run immediately.
 */
export const DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS = Number.isFinite(Number(process.env.THOUGHT_DISTRIBUTOR_MIN_INTERVAL_SECONDS))
    ? Number(process.env.THOUGHT_DISTRIBUTOR_MIN_INTERVAL_SECONDS)
    : 900; // 15 minutes

export default DISTRIBUTOR_MIN_SECONDS_BETWEEN_RUNS;
