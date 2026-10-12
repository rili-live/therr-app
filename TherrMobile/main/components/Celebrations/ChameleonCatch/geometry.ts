/**
 * Every coordinate the daily-bonus scene is drawn and animated with, in scene units.
 *
 * The scene is one 300 × 190 drawing; each layer is an `Svg` with this same viewBox stacked on
 * the others, so parts line up without measuring anything at runtime. The character is the
 * approved side-on chameleon (helmet head and casque, a turret eye opening to a small aperture,
 * a long mouth line, a back that runs straight into a coiled tail, jointed limbs gripping a
 * brown stick). Shapes are stored as the points they are drawn through, and `rig.ts` turns them
 * into paths, so this file is data only.
 */

export type Point = readonly [number, number];

export const SCENE_WIDTH = 300;
export const SCENE_HEIGHT = 190;
export const VIEW_BOX = `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`;
/** The celebration screen's horizontal padding, both sides; the scene shrinks to fit inside it. */
export const SCREEN_GUTTER = 48;

// ---- Character -------------------------------------------------------------------------------

/** Where the body scales from when it breathes, squashes and rises: the line its feet grip. */
export const BODY_PIVOT: Point = [96, 136];

/** The back, from the nape to the hips. The tail outline continues from the last point. */
export const DORSAL: Point[] = [[118, 80], [100, 68], [82, 64], [66, 69], [54, 80]];
/** The underside, from where the tail meets the belly forward to the chest. */
export const BELLY: Point[] = [[56, 119], [70, 122], [84, 126], [100, 126], [116, 122], [126, 112], [126, 96]];

/** The tail leaves the hips here, sweeps down-left and coils counter-clockwise under the stick. */
export const TAIL = {
    base: [50, 104] as Point,
    /** Control points of the lead-in curve from the hips to the start of the coil. */
    leadControl: [40, 112] as Point,
    leadToCoilLift: 22,
    coilCenter: [32, 152] as Point,
    coilRadius: 15.5,
    /** How far the coil winds, in radians (400°). */
    coilTurn: (400 * Math.PI) / 180,
    /** Share of the coil radius it has lost by the tip. */
    coilShrink: 0.66,
    baseHalfWidth: 11,
    tipHalfWidth: 1.4,
    /** Width falls off as `u ^ taper`, so the tail stays thick out of the hips. */
    taper: 0.55,
    leadSamples: 8,
    coilSamples: 22,
    /** The first outline samples sit inside the body; dropping them keeps the join smooth. */
    skipOuter: 1,
    skipInner: 3,
    /** Idle coil breathing: ± share of the coil radius. */
    breathe: 0.06,
};

/** The head shrinks toward the nape (the approved head is 84% of the first draw). */
export const HEAD_ORIGIN: Point = [112, 98];
export const HEAD: Point[] = [
    [175.8, 99.7], [171.6, 90.4], [159.9, 81.2], [144.8, 73.6], [130.5, 64.4], [119.6, 57.7], [110.3, 62.7],
    [107.0, 76.2], [112.0, 93.0], [118.7, 109.8], [132.2, 116.5], [150.6, 114.8], [165.8, 109.8], [174.2, 104.7],
];
/** A faint ridge along the helmet. */
export const CASQUE_RIDGE: Point[] = [[119.6, 59.4], [127.1, 66.1], [137.2, 72.8]];
export const MOUTH: Point = [175.0, 102.2];
export const MOUTH_LINE: Point[] = [[175.0, 103.0], [165.8, 107.2], [152.3, 109.8], [140.6, 108.9], [136.4, 105.6]];
/** The open mouth: a sliver behind the lip, drawn while the tongue is out. */
export const MOUTH_OPEN = 'M 175 103 Q 167.4 108.1 157.4 108.9 Q 167.4 104.7 175 102.2 Z';
export const NOSTRIL: Point = [170.8, 94.6];
export const NOSTRIL_RADIUS = 1.3;
export const NOSTRIL_OPACITY = 0.62;
export const LINE_WIDTH = 1.7;
export const LINE_OPACITY = 0.85;

/**
 * The turret eye: a skin-covered sphere with a cone lid, opening to a small aperture with a
 * white rim, the pupil and the logo's highlight.
 */
export const EYE = {
    center: [147.3, 89.6] as Point,
    turretRadius: 11.76,
    /** The lid ring, as a share of the turret, following the aperture at `ringFollow`. */
    ringRadius: 0.7,
    ringFollow: 0.5,
    ringWidth: 1.6,
    ringOpacity: 0.45,
    apertureRadius: 0.42,
    pupilRadius: 0.27,
    /** The pupil sits a touch forward in the aperture: the eye is on the rock. */
    pupilLead: 0.6,
    highlightRadius: 0.1,
    /** The logo's highlight offset, as a share of the pupil radius. */
    highlight: [0.32, -0.3] as Point,
    /** How far the aperture may swivel from the turret centre. */
    maxSwivel: 3.5,
};

/** Where the aperture points, as offsets from the turret centre. */
export const GAZE = {
    rest: [2, 0.5] as Point,
    rock: [3, 1.5] as Point,
    viewer: [0, 0] as Point,
    up: [0.5, -3.5] as Point,
};

/** The flank stripe: a tapered band along a curve, wide end forward, like the logo's. */
export const STRIPE = {
    from: [114, 100] as Point,
    control1: [98, 88] as Point,
    control2: [74, 88] as Point,
    to: [56, 98] as Point,
    frontHalfWidth: 3.4,
    rearHalfWidth: 1.8,
    samples: 10,
};

/** Limbs: shoulder or hip (rides on the body), elbow or knee, and the foot (fixed on the stick). */
export interface ILimb {
    root: Point;
    joint: Point;
    foot: Point;
}
export const LIMBS_FAR: ILimb[] = [
    { root: [112, 114], joint: [128, 121], foot: [140, 135.1] },
    { root: [74, 114], joint: [64, 124], foot: [56, 140.8] },
];
export const LIMBS_NEAR: ILimb[] = [
    { root: [118, 112], joint: [110, 125], foot: [122, 136.1] },
    { root: [68, 112], joint: [82, 122], foot: [74, 139.3] },
];
export const LIMB_WIDTH_FAR = 6;
export const LIMB_WIDTH_NEAR = 6.5;
/** Each foot is two toe bundles closing over the stick, front and back. */
export const TOE_SPREAD = 3.2;
export const TOE_DROP = 0.8;
export const TOE_RADIUS = 3.1;

/** The tongue: a quadratic from the mouth to `reach` of the way to the rock face. */
export const TONGUE = {
    target: [236, 122] as Point,
    /** The control point lifts this far at full reach, so the strike arcs. */
    lift: -6,
    width: 4,
    tipRadius: 4.6,
    /** Below this reach the tip shrinks away, so a retracted tongue ends inside the mouth. */
    tipFadeReach: 0.08,
    /** On contact the tip flattens against the rock face. */
    contactSquash: 0.7,
    /** Share of the gap to the rock each tap reaches. */
    reach: [0.4, 0.72, 1],
};

// ---- Scenery ---------------------------------------------------------------------------------

/**
 * The set bleeds this far past the scene's left edge, so the stick runs on toward its tree
 * off screen instead of stopping at the scene's box.
 */
export const SET_BLEED = 160;
/**
 * The stick, from a tree branch off the left edge, tapering to its tip; and its shaded underside.
 * West of x = -10 each edge carries straight on along its own tangent, thickening toward the tree.
 */
export const BRANCH = 'M -170 166.6 L -10 147 Q 80 136 204 132 Q 209 132.5 207 136 Q 204 138.5 196 139 Q 90 145 -10 164 L -170 194.4 Z';
export const BRANCH_UNDERSIDE = 'M -170 182.6 L -10 157 Q 90 141 200 138.6 Q 196 139 196 139 Q 90 145 -10 164 L -170 194.4 Z';
export const TWIG = 'M 150 141 Q 158 150 168 154';
export const TWIG_WIDTH = 3;
/** Leaves as base, tip and how far the blade bulges either side of the midline. */
export const LEAVES: { base: Point; tip: Point; bulge: number }[] = [
    { base: [196, 134], tip: [210, 120], bulge: 5.5 },
    { base: [168, 154], tip: [182, 160], bulge: 4.5 },
    { base: [160, 148], tip: [152, 162], bulge: 4 },
    { base: [14, 144], tip: [4, 128], bulge: 5 },
];
export const LEAF_BULGE_SCALE = 1.4;

/** The mound the rock sits on: a self-contained patch of ground, flat-topped at y = 150. */
export const HILL = 'M 206 168 C 209 157 215 150 228 150 L 287 150 C 296 150 300 157 300 164 Q 300 170 294 170 L 212 170 Q 205 170 206 168 Z';

/** The rock: an outline and two facets as rounded polygons, rocking about its base. */
export const ROCK = {
    outline: [[229, 152], [228, 134], [240, 118], [258, 112], [278, 118], [289, 134], [288, 152]] as Point[],
    outlineRadius: 6,
    lightFacet: [[232, 128], [241, 118], [258, 112], [276, 117], [262, 126], [244, 132]] as Point[],
    darkFacet: [[262, 126], [276, 117], [289, 134], [288, 152], [270, 152]] as Point[],
    facetRadius: 4,
    pivot: [258, 152] as Point,
    /** The middle of the rock: where the shards and the gems come from. */
    centre: [258, 132] as Point,
    crack: 'M 247 118 L 252 128 L 246 136 L 254 146',
    crackLength: 34,
    crackWidth: 2.2,
    /** A four-point glint on the light facet: the hint that there is something inside. */
    glint: [248, 121] as Point,
    glintSize: 4,
    /** Wobble on a near miss, in degrees, per tap. */
    wobble: [3, 6],
    hitStopScale: 1.04,
};

/** Three shards in the facet colours fly this far from the rock's centre as it bursts. */
export const SHARDS: { from: Point; points: Point[]; tone: 'base' | 'light' | 'dark' }[] = [
    { from: [-1, -1], points: [[-6, -4], [5, -6], [4, 5], [-5, 4]], tone: 'light' },
    { from: [1, -0.4], points: [[-5, -5], [6, -2], [2, 6]], tone: 'dark' },
    { from: [-0.6, 0.8], points: [[-6, 0], [0, -5], [6, 2], [0, 5]], tone: 'base' },
];
export const SHARD_DISTANCE = 34;
/** The shards drop as they fly, this far by the end. */
export const SHARD_DROP = 14;
export const SHARD_CORNER = 1.5;
/** Each shard is drawn in a box this size around its own centre. */
export const SHARD_BOX = 16;
export const SHARD_SPIN_DEG = 90;
/** The impact ring that marks the burst: grows from the rock's centre as it thins and fades. */
export const BURST_RING = {
    fromRadius: 10,
    toRadius: 46,
    width: 4,
};

// ---- Gems ------------------------------------------------------------------------------------

/** A cut gem around its own centre, and its highlight facet. */
export const GEM_PATH = 'M -4 -5 L 4 -5 L 7 -1 L 0 7 L -7 -1 Z';
export const GEM_FACET_PATH = 'M -4 -5 L 0 -1 L -7 -1 Z';
export const GEM_SIZE = 16;
/** Gems are drawn at this multiple of their path's size. */
export const GEM_SCALE = 1.35;
export const GEM_STROKE = 1.5;
export const GEM_FACET_OPACITY = 0.6;

export const GEM_PHYSICS = {
    /** Where the gems leave from: the middle of the rock. */
    origin: ROCK.centre,
    /** Scene units per second squared. */
    gravity: 1100,
    /** Horizontal air drag, per second: a fast pop outward, then a near-vertical fall. */
    drag: 4.2,
    /** Share of the landing speed a gem keeps for its one bounce. */
    restitution: 0.2,
    /** Each gem launches this long after the one before it. */
    staggerSeconds: 0.016,
    baseLaunchSpeed: 300,
    /** Higher rows of the pile launch harder, so they land after the rows under them. */
    launchSpeedPerRow: 22,
    launchSpeedJitter: 40,
    spinMin: 300,
    spinJitter: 260,
    /** Spin kept through the bounce. */
    bounceSpin: 0.15,
};

/** The pile the gems land in, centred where the rock stood. */
export const GEM_PILE = {
    centerX: 257,
    /** Resting centre of a gem on the bottom row: the mound top, less the gem's point below centre. */
    baseY: 141,
    column: 13,
    row: 9.5,
    /** Rows sag at their ends, so the pile is a mound rather than a stack. */
    sag: 1.5,
    jitter: 2.5,
    /** Rest tilt, in degrees either way. */
    tilt: 14,
    /** A jackpot's second volley tops the pile up with this many more. */
    jackpotExtra: 5,
};
