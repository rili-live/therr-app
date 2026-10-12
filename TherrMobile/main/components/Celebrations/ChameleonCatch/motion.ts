/**
 * The timing of the daily-bonus reveal, in milliseconds from the tap that starts each beat.
 * It is the approved motion spec, as numbers: the animations and the JS milestones (caught,
 * revealed, counted) both read from here, so the two cannot drift apart.
 */

// ---- Idle ------------------------------------------------------------------------------------

/** One breath, in and out. */
export const BREATH_MS = 3600;
export const BREATH_SCALE_Y = 0.025;
export const BREATH_SCALE_X = -0.005;
/** The tail coil breathes on its own, slower loop, a quarter cycle behind the body. */
export const COIL_MS = 4800;
export const COIL_OFFSET_MS = COIL_MS / 4;

/** Gaps between blinks. A fixed table, not `Math.random`, so every recording repeats. */
export const BLINK_GAPS_MS = [2800, 4300, 3500, 5200];
/** Every fourth blink is a double. */
export const BLINK_DOUBLE_EVERY = 4;
export const BLINK_CLOSE_MS = 70;
export const BLINK_HOLD_MS = 40;
export const BLINK_OPEN_MS = 110;
export const BLINK_DOUBLE_GAP_MS = 120;

/** The idle glance: rest → rock → viewer → rest. */
export const GLANCE_EVERY_MS = 6000;
export const GLANCE_MOVE_MS = 220;
export const GLANCE_ROCK_HOLD_MS = 900;
export const GLANCE_VIEWER_HOLD_MS = 600;

/** The glint on the rock. */
export const GLINT_EVERY_MS = 4000;
export const GLINT_MS = 500;

// ---- Taps 1 and 2 ----------------------------------------------------------------------------

export const ANTICIPATION_MS = 80;
/** Head pull-back and body squash on the anticipation, per tap (the catch winds up deeper). */
export const HEAD_PULL = [5, 5, 8];
export const SQUASH = [0.07, 0.07, 0.11];
/** The body keeps its volume: it widens by this share of what it loses in height. */
export const SQUASH_WIDEN = 0.6;
/** The head snaps forward past rest by this much on the strike. */
export const HEAD_SNAP = 2;

export const STRIKE_MS = 120;
/** Hold at full reach before the recoil. */
export const STRIKE_HOLD_MS = 60;
export const RECOIL_MS = 160;
export const COLOUR_MS = 250;
/** The rock acknowledges the near miss once the tongue peaks. */
export const ROCK_WOBBLE_AT_MS = ANTICIPATION_MS + STRIKE_MS;
export const ROCK_WOBBLE_IN_MS = 70;

// ---- Tap 3: the catch ------------------------------------------------------------------------

/** Short and out-quad, so the tongue visibly lands on the contact frame the cue fires on. */
export const CATCH_STRIKE_MS = 70;
/** The tongue touches the rock. */
export const CONTACT_AT_MS = ANTICIPATION_MS + CATCH_STRIKE_MS;
/** A few frames frozen while the crack draws in. */
export const HIT_STOP_MS = 70;
export const CRACK_MS = 60;
/** The rock bursts, the gems launch, and the reveal counts as made. */
export const BURST_AT_MS = CONTACT_AT_MS + HIT_STOP_MS;
/**
 * The JS side of the reveal (the route's `onRevealed`, the accessibility state) waits this long
 * after the burst, so no React commit lands on the burst frame itself. The gems are mid-air.
 */
export const REVEAL_JS_AFTER_BURST_MS = 150;
/** The aiming hint gives way to the result area as the rock bursts. */
export const RESULT_SWAP_MS = 200;
export const SHARDS_MS = 300;
export const GOLD_MS = 300;

/** The triumph: the body rises on its legs, the head tilts up, the eyes follow the gems. */
export const RISE_MS = 200;
export const RISE_SCALE = 0.06;
/** The body settles back from the rise to a proud stance, this share of the way up. */
export const RISE_REST = 0.3;
export const HEAD_TILT_DEG = -6;
export const LOOK_UP_MS = 200;
export const LOOK_UP_HOLD_MS = 500;
export const LOOK_BACK_MS = 300;

/** How long the gem clock runs: every gem is on the pile well before it stops. */
export const GEM_CLOCK_MS = 1400;

/** The count-up starts as the gems pass their apex. */
export const COUNT_AT_MS = BURST_AT_MS + 420;
export const COUNT_BASE_MS = 600;
export const COUNT_PER_XP_MS = 15;
export const COUNT_MAX_EXTRA_MS = 900;
export const getCountDuration = (bonusXp: number) => COUNT_BASE_MS + Math.min(COUNT_MAX_EXTRA_MS, bonusXp * COUNT_PER_XP_MS);
export const XP_POP_FROM = 0.6;
/** The tip squashes on the rock over the first part of the hit-stop and recovers over the rest. */
export const CONTACT_SQUASH_MS = 40;

/** After the count lands: the rarity flourish. */
export const LABEL_RISE = 8;
export const LABEL_MS = 200;
export const PUNCH_SCALE = 1.08;
export const PUNCH_MS = 240;
export const TWINKLE_MS = 600;
/** The twinkle sweep starts and ends off the pile, so the end gems light fully too. */
export const TWINKLE_FROM = -0.25;
export const TWINKLE_TO = 1.25;
export const SHAKE_DEG = 2;
export const SHAKE_BEAT_MS = 70;
/** A jackpot fires a second, smaller volley of gems. */
export const SECOND_VOLLEY_AT_MS = BURST_AT_MS + 250;

// ---- Reduce motion ---------------------------------------------------------------------------

export const REDUCED_COLOUR_MS = 200;
export const REDUCED_REVEAL_MS = 250;
