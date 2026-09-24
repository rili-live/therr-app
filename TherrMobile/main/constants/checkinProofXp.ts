/**
 * Bonus leaderboard XP for proof on a completed check-in, for display only.
 *
 * The users-service decides what is actually awarded (`LeaderboardXpValues.proofNote` /
 * `proofPhoto` and `checkinProofXp` in its utilities/leaderboardHelpers.ts) and reports it
 * back on the check-in as `proofXpEarned`. These mirror those values for the hint copy that
 * is shown *before* anything is saved — change both together.
 */
export const CHECKIN_PROOF_XP = {
    note: 5,
    photo: 10,
};
