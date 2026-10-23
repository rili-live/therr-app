import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

/**
 * habits.therr.com/c/:token — a Friends with Habits challenge's public page and its share card.
 *
 * The page is what a challenge link opens: the scoreboard, and a way to join without installing
 * anything. The card (/c/:token/card.png) is its og:image, so the link unfurls in iMessage,
 * WhatsApp, Slack or X as a picture of the standings rather than a bare URL — every share is
 * an ad for the challenge.
 *
 * The card is a hand-laid-out SVG rasterised by resvg's WebAssembly build. Pure WASM on purpose:
 * the client image installs its dependencies with `--omit=optional`, which is exactly where a
 * native image library's per-platform binaries live, and a layout engine is not needed for a
 * fixed 1200x630 card with a handful of lines.
 */

export const CHALLENGE_PATH_RE = /^\/c\/([A-Za-z0-9]{12})\/?$/;
export const CHALLENGE_CARD_PATH_RE = /^\/c\/([A-Za-z0-9]{12})\/card\.png$/;

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** The subset of GET /habits/challenges/by-token/:token this module reads. */
export interface IPublicChallenge {
    joinToken: string;
    title: string;
    habitGoalId: string;
    goal: { name: string; emoji?: string | null; amountUnit?: string | null };
    creator: { userName: string; displayName: string };
    startDate: string;
    endDate: string;
    status: string;
    hasStarted: boolean;
    hasEnded: boolean;
    daysLeft: number;
    durationDays: number;
    memberCount: number;
    isFull: boolean;
    rankedBy: 'amount' | 'checkinDays';
    standings: {
        rank: number;
        userName: string;
        displayName: string;
        checkinDays: number;
        totalAmount: number;
    }[];
}

const formatAmount = (amount: number): string => {
    const rounded = Math.round(amount * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

/** "12 days", "1 day", or "42.5 km" for a measured goal. */
export const formatScore = (
    row: { checkinDays: number; totalAmount: number },
    rankedBy: IPublicChallenge['rankedBy'],
    amountUnit?: string | null,
): string => {
    if (rankedBy === 'amount') {
        return `${formatAmount(row.totalAmount)}${amountUnit ? ` ${amountUnit}` : ''}`;
    }
    return `${row.checkinDays} ${row.checkinDays === 1 ? 'day' : 'days'}`;
};

/** "7 days left", "Last day", "Final results". */
export const formatTimeLeft = (challenge: Pick<IPublicChallenge, 'hasEnded' | 'daysLeft'>): string => {
    if (challenge.hasEnded) {
        return 'Final results';
    }
    if (challenge.daysLeft === 1) {
        return 'Last day';
    }
    return `${challenge.daysLeft} days left`;
};

/** Values for habits/challenge.hbs. Handlebars escapes `{{value}}`, so nothing is pre-escaped. */
export const buildChallengeViewContext = (challenge: IPublicChallenge) => {
    const challengeUrl = `https://habits.therr.com/c/${challenge.joinToken}`;
    const timeLeft = formatTimeLeft(challenge);
    const leader = challenge.standings[0];
    const hasProgress = challenge.standings.some((row) => row.checkinDays > 0);
    const durationLabel = `${challenge.durationDays}-day`;

    return {
        title: `${challenge.title}: ${challenge.creator.displayName}'s ${durationLabel} challenge | Friends with Habits`,
        description: hasProgress && leader
            ? `${challenge.memberCount} in, ${leader.displayName} leads with ${formatScore(leader, challenge.rankedBy, challenge.goal.amountUnit)}. `
                + `${timeLeft}. Join free and check in from your phone.`
            : `${challenge.creator.displayName} started a ${durationLabel} ${challenge.goal.name} challenge. `
                + 'Join free, check in daily, and see who keeps it up.',
        canonicalUrl: challengeUrl,
        cardUrl: `${challengeUrl}/card.png`,
        challengeTitle: challenge.title,
        goalName: challenge.goal.name,
        goalEmoji: challenge.goal.emoji || '',
        creatorName: challenge.creator.displayName,
        durationLabel,
        timeLeft,
        memberCount: challenge.memberCount,
        memberLabel: challenge.memberCount === 1 ? 'person' : 'people',
        hasEnded: challenge.hasEnded,
        isJoinable: !challenge.hasEnded && !challenge.isFull,
        isFull: challenge.isFull,
        rankedByLabel: challenge.rankedBy === 'amount' && challenge.goal.amountUnit
            ? `Ranked by total ${challenge.goal.amountUnit}`
            : 'Ranked by days checked in',
        standings: challenge.standings.map((row) => ({
            rank: row.rank,
            userName: row.userName,
            displayName: row.displayName,
            score: formatScore(row, challenge.rankedBy, challenge.goal.amountUnit),
        })),
        hasStandings: challenge.standings.length > 0,
        joinToken: challenge.joinToken,
        habitGoalId: challenge.habitGoalId,
    };
};

const escapeXml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Cut to `max` characters with an ellipsis. Measured in code points so a name with an accent or
 * a surrogate pair is never split mid-character.
 */
export const truncate = (value: string, max: number): string => {
    const chars = Array.from(value.trim());
    return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
};

// Emoji are stripped from card text: the bundled font has no emoji glyphs, and a missing glyph
// renders as an empty box. The page itself still shows them.
const stripEmoji = (value: string): string => value.replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();

const cardText = (value: string, max: number) => escapeXml(truncate(stripEmoji(value), max));

/** The share card as SVG. Fixed layout, one line per item; long values are truncated. */
export const buildChallengeCardSvg = (challenge: IPublicChallenge): string => {
    const top = challenge.standings.slice(0, 3);
    const hasProgress = top.some((row) => row.checkinDays > 0);
    const subtitle = `${challenge.creator.displayName}'s ${challenge.durationDays}-day challenge · `
        + `${challenge.memberCount} ${challenge.memberCount === 1 ? 'person' : 'people'} in`;

    const rows = hasProgress
        ? top.map((row, index) => {
            const y = 344 + index * 60;
            return `<text x="96" y="${y}" class="rank">${row.rank}</text>`
                + `<text x="150" y="${y}" class="name">${cardText(row.displayName, 26)}</text>`
                + `<text x="1104" y="${y}" class="score" text-anchor="end">`
                + `${escapeXml(formatScore(row, challenge.rankedBy, challenge.goal.amountUnit))}</text>`;
        }).join('')
        : '<text x="96" y="380" class="name">Nobody has checked in yet.</text>'
            + '<text x="96" y="440" class="muted">The first check-in takes the lead.</text>';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`
        + '<style>'
        + 'text{font-family:Lexend}'
        + '.brand{font-size:24px;font-weight:700;fill:#f6c94a;letter-spacing:3px}'
        + '.title{font-size:62px;font-weight:700;fill:#ffffff}'
        + '.sub{font-size:28px;fill:#ece6f3}'
        + '.rank{font-size:34px;font-weight:700;fill:#f6c94a}'
        + '.name{font-size:34px;fill:#ffffff}'
        + '.score{font-size:34px;font-weight:700;fill:#ffffff}'
        + '.muted{font-size:28px;fill:#b9aecb}'
        + '.cta{font-size:28px;font-weight:700;fill:#2e2140}'
        + '.left{font-size:28px;font-weight:700;fill:#f6c94a}'
        + '</style>'
        + '<rect width="100%" height="100%" fill="#2e2140"/>'
        + '<rect x="0" y="0" width="12" height="100%" fill="#f6c94a"/>'
        + '<text x="96" y="92" class="brand">FRIENDS WITH HABITS · CHALLENGE</text>'
        + `<text x="96" y="176" class="title">${cardText(challenge.title, 30)}</text>`
        + `<text x="96" y="230" class="sub">${cardText(subtitle, 64)}</text>`
        + `<rect x="72" y="282" width="1056" height="218" rx="20" fill="#1f1630"/>${
            rows
        }<rect x="72" y="532" width="440" height="64" rx="32" fill="#f6c94a"/>`
        + '<text x="292" y="574" class="cta" text-anchor="middle">Join at habits.therr.com</text>'
        + `<text x="1128" y="574" class="left" text-anchor="end">${escapeXml(formatTimeLeft(challenge))}</text>`
        + '</svg>';
};

// ── Rasterising ──
// Loaded lazily so a server that never renders a card never pays for the WASM module, and once,
// because initWasm throws if called twice.

let resvgPromise: Promise<any> | null = null;
let fontBuffers: Uint8Array[] | null = null;

const loadResvg = (): Promise<any> => {
    if (!resvgPromise) {
        resvgPromise = (async () => {
            // createRequire rather than require.resolve: this file is bundled by webpack, which
            // rewrites a bare require.resolve into a module id. Resolving from the process cwd
            // walks up to the root node_modules both locally and in the client image.
            const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
            const resvg = nodeRequire('@resvg/resvg-wasm');
            const wasm = fs.readFileSync(nodeRequire.resolve('@resvg/resvg-wasm/index_bg.wasm'));
            await resvg.initWasm(wasm);
            return resvg;
        })().catch((err) => {
            // Let the next request retry rather than caching a failure forever.
            resvgPromise = null;
            throw err;
        });
    }
    return resvgPromise;
};

const loadFonts = (fontsDir: string): Uint8Array[] => {
    if (!fontBuffers) {
        fontBuffers = ['Lexend-Regular.ttf', 'Lexend-Bold.ttf']
            .map((file) => new Uint8Array(fs.readFileSync(path.join(fontsDir, file))));
    }
    return fontBuffers;
};

export const renderSvgToPng = async (svg: string, fontsDir: string): Promise<Buffer> => {
    const resvg = await loadResvg();
    const renderer = new resvg.Resvg(svg, {
        fitTo: { mode: 'width', value: CARD_WIDTH },
        font: {
            fontBuffers: loadFonts(fontsDir),
            defaultFontFamily: 'Lexend',
        },
    });
    try {
        return Buffer.from(renderer.render().asPng());
    } finally {
        renderer.free();
    }
};
