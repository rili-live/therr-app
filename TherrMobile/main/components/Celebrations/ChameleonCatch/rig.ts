/**
 * The math behind the daily-bonus scene: path builders and gem physics.
 *
 * Every function that runs per frame carries the `'worklet'` directive, so it can be called
 * from `useAnimatedProps` / `useAnimatedStyle` on the UI runtime as well as from plain JS
 * (module setup and the unit tests). They are pure functions of their arguments and of the
 * constants in `geometry.ts`, never of anything a component holds.
 */
import {
    BELLY,
    BODY_PIVOT,
    DORSAL,
    GEM_PHYSICS,
    GEM_PILE,
    ILimb,
    LEAF_BULGE_SCALE,
    Point,
    STRIPE,
    TAIL,
    TOE_DROP,
    TOE_RADIUS,
    TOE_SPREAD,
    TONGUE,
} from './geometry';

const fmt = (value: number) => {
    'worklet';

    return (Math.round(value * 10) / 10).toString();
};

/** A closed Catmull-Rom spline through `points`, as cubic Béziers. */
export const closedSpline = (points: readonly Point[]): string => {
    'worklet';

    const count = points.length;
    let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
    for (let i = 0; i < count; i += 1) {
        const p0 = points[(i - 1 + count) % count];
        const p1 = points[i];
        const p2 = points[(i + 1) % count];
        const p3 = points[(i + 2) % count];
        d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)}`
            + ` ${fmt(p2[0] - (p3[0] - p1[0]) / 6)} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)}`
            + ` ${fmt(p2[0])} ${fmt(p2[1])}`;
    }
    return `${d} Z`;
};

/** An open Catmull-Rom spline through `points`, with its ends clamped. */
export const openSpline = (points: readonly Point[]): string => {
    'worklet';

    const count = points.length;
    let d = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`;
    for (let i = 0; i < count - 1; i += 1) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(count - 1, i + 2)];
        d += ` C ${fmt(p1[0] + (p2[0] - p0[0]) / 6)} ${fmt(p1[1] + (p2[1] - p0[1]) / 6)}`
            + ` ${fmt(p2[0] - (p3[0] - p1[0]) / 6)} ${fmt(p2[1] - (p3[1] - p1[1]) / 6)}`
            + ` ${fmt(p2[0])} ${fmt(p2[1])}`;
    }
    return d;
};

/** A polygon with every corner rounded by `radius` (a quadratic through the vertex). */
export const roundedPolygon = (vertices: readonly Point[], radius: number): string => {
    const count = vertices.length;
    const toward = (from: Point, to: Point): Point => {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
        const share = Math.min(0.5, radius / length);
        return [from[0] + (to[0] - from[0]) * share, from[1] + (to[1] - from[1]) * share];
    };
    const corners = vertices.map((vertex, i) => ({
        enter: toward(vertex, vertices[(i - 1 + count) % count]),
        vertex,
        leave: toward(vertex, vertices[(i + 1) % count]),
    }));
    let d = `M ${fmt(corners[0].leave[0])} ${fmt(corners[0].leave[1])}`;
    for (let i = 1; i <= count; i += 1) {
        const corner = corners[i % count];
        d += ` L ${fmt(corner.enter[0])} ${fmt(corner.enter[1])}`
            + ` Q ${fmt(corner.vertex[0])} ${fmt(corner.vertex[1])} ${fmt(corner.leave[0])} ${fmt(corner.leave[1])}`;
    }
    return `${d} Z`;
};

/** An almond leaf from its base to its tip. */
export const leafPath = (base: Point, tip: Point, bulge: number): string => {
    const midX = (base[0] + tip[0]) / 2;
    const midY = (base[1] + tip[1]) / 2;
    const length = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
    const nx = (-(tip[1] - base[1]) / length) * bulge * LEAF_BULGE_SCALE;
    const ny = ((tip[0] - base[0]) / length) * bulge * LEAF_BULGE_SCALE;
    return `M ${fmt(base[0])} ${fmt(base[1])} Q ${fmt(midX + nx)} ${fmt(midY + ny)} ${fmt(tip[0])} ${fmt(tip[1])}`
        + ` Q ${fmt(midX - nx)} ${fmt(midY - ny)} ${fmt(base[0])} ${fmt(base[1])} Z`;
};

/** Circles as one path, so a set of them takes a single animated fill. */
export const circlesPath = (circles: readonly { x: number; y: number; r: number }[]): string => circles
    .map(({ x, y, r }) => `M ${fmt(x - r)} ${fmt(y)} a ${r} ${r} 0 1 0 ${fmt(r * 2)} 0 a ${r} ${r} 0 1 0 ${fmt(-r * 2)} 0`)
    .join(' ');

/** Each foot is two toe bundles closing over the stick. */
export const toesPath = (limbs: readonly ILimb[]): string => circlesPath(limbs.flatMap(({ foot }) => [
    { x: foot[0] - TOE_SPREAD, y: foot[1] + TOE_DROP, r: TOE_RADIUS },
    { x: foot[0] + TOE_SPREAD, y: foot[1] + TOE_DROP, r: TOE_RADIUS },
]));

const cubicAt = (p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point => {
    'worklet';

    const u = 1 - t;
    return [
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ];
};

/**
 * Offsets a centreline both ways by a half-width that runs from `fromHalf` to `toHalf`, giving
 * the two edges of a tapered band. `left` is the side to the left of travel on screen.
 */
const offsetEdges = (centre: Point[], halfWidthAt: (u: number) => number) => {
    'worklet';

    const left: Point[] = [];
    const right: Point[] = [];
    const last = centre.length - 1;
    for (let i = 0; i <= last; i += 1) {
        const a = centre[Math.max(0, i - 1)];
        const b = centre[Math.min(last, i + 1)];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / length;
        const ny = (b[0] - a[0]) / length;
        const half = halfWidthAt(i / last);
        left.push([centre[i][0] + nx * half, centre[i][1] + ny * half]);
        right.push([centre[i][0] - nx * half, centre[i][1] - ny * half]);
    }
    return { left, right };
};

/**
 * The back and tail as one silhouette. The tail runs from the hips into a coil whose radius is
 * scaled by `coilScale` (the idle breathing), so it is rebuilt rather than rotated and the join
 * between back and tail never opens.
 */
export const bodyPath = (coilScale: number): string => {
    'worklet';

    const radius = TAIL.coilRadius * coilScale;
    const coilStart: Point = [TAIL.coilCenter[0] - radius, TAIL.coilCenter[1]];
    const centre: Point[] = [];
    for (let i = 0; i < TAIL.leadSamples; i += 1) {
        centre.push(cubicAt(
            TAIL.base,
            TAIL.leadControl,
            [coilStart[0], coilStart[1] - TAIL.leadToCoilLift],
            coilStart,
            i / TAIL.leadSamples,
        ));
    }
    for (let i = 0; i <= TAIL.coilSamples; i += 1) {
        const u = i / TAIL.coilSamples;
        const angle = Math.PI - TAIL.coilTurn * u;
        const r = radius * (1 - TAIL.coilShrink * u);
        centre.push([TAIL.coilCenter[0] + r * Math.cos(angle), TAIL.coilCenter[1] + r * Math.sin(angle)]);
    }
    const { left, right } = offsetEdges(
        centre,
        (u) => {
            'worklet';

            return TAIL.baseHalfWidth + (TAIL.tipHalfWidth - TAIL.baseHalfWidth) * u ** TAIL.taper;
        },
    );
    // Travelling down and then counter-clockwise, the outside of the curl (the back) is on the left.
    const outer = left.slice(TAIL.skipOuter);
    const inner = right.slice(TAIL.skipInner).reverse();
    return closedSpline([...DORSAL, ...outer, ...inner, ...BELLY]);
};

/** The tapered flank stripe. Static, so it is built once. */
export const stripePath = (): string => {
    const centre: Point[] = [];
    for (let i = 0; i <= STRIPE.samples; i += 1) {
        centre.push(cubicAt(STRIPE.from, STRIPE.control1, STRIPE.control2, STRIPE.to, i / STRIPE.samples));
    }
    const { left, right } = offsetEdges(
        centre,
        (u) => STRIPE.frontHalfWidth + (STRIPE.rearHalfWidth - STRIPE.frontHalfWidth) * u,
    );
    return closedSpline([...left, ...right.reverse()]);
};

/** A point on the body, after the body has scaled about its pivot. */
export const onBody = (point: Point, scaleX: number, scaleY: number): Point => {
    'worklet';

    return [
        BODY_PIVOT[0] + (point[0] - BODY_PIVOT[0]) * scaleX,
        BODY_PIVOT[1] + (point[1] - BODY_PIVOT[1]) * scaleY,
    ];
};

/**
 * Jointed limbs whose roots ride on the body while the feet stay on the stick. The elbow or
 * knee takes half the body's movement, so the leg folds rather than sliding.
 */
export const limbsPath = (limbs: readonly ILimb[], scaleX: number, scaleY: number): string => {
    'worklet';

    let d = '';
    for (let i = 0; i < limbs.length; i += 1) {
        const { root, joint, foot } = limbs[i];
        const movedRoot = onBody(root, scaleX, scaleY);
        const movedJoint = onBody(joint, scaleX, scaleY);
        d += `M ${fmt(movedRoot[0])} ${fmt(movedRoot[1])}`
            + ` L ${fmt((joint[0] + movedJoint[0]) / 2)} ${fmt((joint[1] + movedJoint[1]) / 2)}`
            + ` L ${fmt(foot[0])} ${fmt(foot[1])} `;
    }
    return d;
};

/**
 * The tongue from `mouth` toward the rock face, `reach` of the way there, in the same space as
 * `mouth` and `target`. Returns the path and the tip; at rest both collapse to nothing.
 */
export const tongueShape = (mouth: Point, target: Point, reach: number) => {
    'worklet';

    const shown = Math.max(0, reach);
    if (shown < 0.005) {
        return {
            d: `M ${fmt(mouth[0])} ${fmt(mouth[1])}`, tipX: mouth[0], tipY: mouth[1], tipRadius: 0,
        };
    }
    const tipX = mouth[0] + (target[0] - mouth[0]) * shown;
    const tipY = mouth[1] + (target[1] - mouth[1]) * shown;
    const controlX = (mouth[0] + tipX) / 2;
    // Lifted off the straight line's midpoint, so the strike arcs without hooking at the tip.
    const controlY = (mouth[1] + tipY) / 2 + TONGUE.lift * Math.min(1, shown);
    return {
        d: `M ${fmt(mouth[0])} ${fmt(mouth[1])} Q ${fmt(controlX)} ${fmt(controlY)} ${fmt(tipX)} ${fmt(tipY)}`,
        tipX,
        tipY,
        tipRadius: TONGUE.tipRadius * Math.min(1, shown / TONGUE.tipFadeReach),
    };
};

// ---- Gems ------------------------------------------------------------------------------------

export interface IPileSlot {
    x: number;
    y: number;
    tilt: number;
    row: number;
}

export interface IGemFlight {
    slot: IPileSlot;
    vx: number;
    vy: number;
    /** Seconds after the burst before this gem leaves the rock. */
    delay: number;
    /** Seconds from launch to touching its slot. */
    landAt: number;
    spin: number;
}

/** A golden-ratio sequence: spread evenly, never repeating, and the same on every run. */
const golden = (index: number, step = 0.618) => (index * step) % 1;

/** Rows of the pile, bottom first: the widest row that fits, then one fewer each row up. */
export const getPileRows = (count: number): number[] => {
    let width = 1;
    while ((width * (width + 1)) / 2 < count) {
        width += 1;
    }
    const rows: number[] = [];
    let left = count;
    for (let row = width; left > 0; row -= 1) {
        const take = Math.min(row, left);
        rows.push(take);
        left -= take;
    }
    return rows;
};

/** Where each gem comes to rest: bottom row first, centred where the rock stood. */
export const getPileSlots = (count: number): IPileSlot[] => {
    const slots: IPileSlot[] = [];
    getPileRows(count).forEach((rowCount, row) => {
        for (let column = 0; column < rowCount; column += 1) {
            const jitter = golden(slots.length) - 0.5;
            const fromCentre = column - (rowCount - 1) / 2;
            slots.push({
                x: GEM_PILE.centerX + fromCentre * GEM_PILE.column + jitter * GEM_PILE.jitter,
                y: GEM_PILE.baseY - row * GEM_PILE.row + Math.abs(fromCentre) * GEM_PILE.sag,
                tilt: jitter * 2 * GEM_PILE.tilt,
                row,
            });
        }
    });
    return slots;
};

/** Horizontal distance covered after `t` seconds under drag. */
export const drift = (vx: number, t: number) => {
    'worklet';

    return (vx / GEM_PHYSICS.drag) * (1 - Math.exp(-GEM_PHYSICS.drag * t));
};

/**
 * Each gem's launch, solved so its arc ends exactly on its slot. Bottom slots get the lowest
 * arcs and the earliest launches, so the pile builds from the ground up. Gems from
 * `secondVolleyFrom` on leave `secondVolleyDelay` seconds later.
 */
export const getGemFlights = (count: number, secondVolleyFrom = count, secondVolleyDelay = 0): IGemFlight[] => {
    const [originX, originY] = GEM_PHYSICS.origin;
    const half = GEM_PHYSICS.gravity / 2;
    return getPileSlots(count).map((slot, index) => {
        const vy = -(GEM_PHYSICS.baseLaunchSpeed
            + GEM_PHYSICS.launchSpeedPerRow * slot.row
            + GEM_PHYSICS.launchSpeedJitter * golden(index, 0.382));
        // Time to fall from the origin to the slot's height on the way down.
        const landAt = (-vy + Math.sqrt(vy * vy - 4 * half * (originY - slot.y))) / (2 * half);
        const vx = ((slot.x - originX) * GEM_PHYSICS.drag) / (1 - Math.exp(-GEM_PHYSICS.drag * landAt));
        const isSecondVolley = index >= secondVolleyFrom;
        const order = isSecondVolley ? index - secondVolleyFrom : index;
        // Round the spin to whole turns over the flight, so the gem touches down already at its
        // rest tilt instead of unwinding on the pile.
        const direction = index % 2 ? 1 : -1;
        const wantedTurns = ((GEM_PHYSICS.spinMin + GEM_PHYSICS.spinJitter * golden(index)) * landAt) / 360;
        const turns = Math.max(1, Math.round(wantedTurns));
        return {
            slot,
            vx,
            vy,
            delay: (isSecondVolley ? secondVolleyDelay : 0) + GEM_PHYSICS.staggerSeconds * order,
            landAt,
            spin: (direction * turns * 360 + slot.tilt) / landAt,
        };
    });
};

/**
 * Where a gem is `clock` seconds after the burst: ballistic flight with drag, one small bounce
 * on its slot, then rest at its tilt. Before launch it sits hidden in the rock.
 */
export const gemAt = (flight: IGemFlight, clock: number) => {
    'worklet';

    const t = clock - flight.delay;
    const { slot } = flight;
    if (t <= 0) {
        return {
            x: GEM_PHYSICS.origin[0], y: GEM_PHYSICS.origin[1], rotate: 0, launched: false,
        };
    }
    if (t <= flight.landAt) {
        return {
            x: GEM_PHYSICS.origin[0] + drift(flight.vx, t),
            y: GEM_PHYSICS.origin[1] + flight.vy * t + (GEM_PHYSICS.gravity / 2) * t * t,
            rotate: flight.spin * t,
            launched: true,
        };
    }
    const bounceSpeed = -(flight.vy + GEM_PHYSICS.gravity * flight.landAt) * GEM_PHYSICS.restitution;
    const bounceTime = (-2 * bounceSpeed) / GEM_PHYSICS.gravity;
    const sinceLanding = t - flight.landAt;
    if (sinceLanding < bounceTime) {
        const progress = sinceLanding / bounceTime;
        return {
            x: slot.x,
            y: slot.y + bounceSpeed * sinceLanding + (GEM_PHYSICS.gravity / 2) * sinceLanding * sinceLanding,
            // A little of the spin carries into the bounce and dies out by the time it lands again.
            rotate: slot.tilt + flight.spin * GEM_PHYSICS.bounceSpin * sinceLanding * (1 - progress),
            launched: true,
        };
    }
    return {
        x: slot.x, y: slot.y, rotate: slot.tilt, launched: true,
    };
};
