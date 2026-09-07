import { IHabitCheckin, IHabitCheckinProof } from 'therr-react/types';

/**
 * Presentation logic for the calendar's day-detail sheet.
 *
 * Deliberately free of React Native imports so it can be unit-tested directly —
 * the same trick `pactState.ts` and `Journal/journalGrouping.ts` use.
 */

const MONTH_KEYS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export interface IResolvedProofUri {
    id: string;
    uri: string;
    mediaType: string;
}

/**
 * The sheet's title, built from the locale dictionary rather than
 * `toLocaleDateString`.
 *
 * The month and weekday names have to come from the same dictionary as the rest
 * of the app: `Intl` data is not guaranteed present on Android's Hermes build
 * for every locale the app ships, so a `toLocaleDateString('fr-ca', …)` can
 * silently fall back to English for a French user. The journal's day headings
 * already resolve names this way; this matches them.
 */
export const formatDayTitle = (
    date: Date,
    translate: (key: string, params?: any) => string,
): string => {
    const weekday = translate(`pages.habits.daysOfWeekShort.${WEEKDAY_KEYS[date.getDay()]}`);
    const month = translate(`dateTime.months.${MONTH_KEYS[date.getMonth()]}`);

    return translate('pages.habits.dayDetail.title', {
        weekday,
        month,
        day: date.getDate(),
    });
};

/**
 * What the sheet says happened on this day.
 *
 * `undefined` for a day with no check-in row at all, which the sheet renders as
 * its empty state rather than as a status — "no record" and "pending" are
 * different things, and showing the latter for the former would tell a user
 * they owe a check-in on a day the habit did not exist yet.
 */
export const getStatusLabelKey = (checkin?: IHabitCheckin): string | undefined => {
    if (!checkin) {
        return undefined;
    }

    switch (checkin.status) {
        case 'completed':
        case 'partial':
        case 'skipped':
        case 'missed':
        case 'pending':
            return `pages.habits.dayDetail.status.${checkin.status}`;
        default:
            // A status the client does not know about is still a real row. Say
            // that something was recorded rather than rendering a blank line or
            // the raw enum value.
            return 'pages.habits.dayDetail.status.recorded';
    }
};

/**
 * Is this calendar day in the future, relative to `today`?
 *
 * Both are compared on their local calendar components. The grid renders a full
 * month, so roughly half of a current month's cells are days that have not
 * happened; those get a distinct empty state ("nothing here yet") instead of
 * the past's ("no check-in recorded"), which otherwise reads as a missed day.
 */
export const isDayInFuture = (date: Date, today: Date): boolean => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    return dayStart > todayStart;
};

/**
 * Pair each proof with the URL the media store resolved for it, dropping any
 * that has not resolved yet.
 *
 * `content.media` is keyed by path and filled asynchronously by
 * `MapActions.fetchMedia`, so between opening the sheet and that response
 * landing, a proof has a path and no URI. Rendering an `<Image>` with an
 * undefined `uri` shows a permanent blank tile with no error, so the sheet
 * counts these as still-loading instead.
 */
export const resolveProofUris = (
    proofs: IHabitCheckinProof[],
    mediaMap: Record<string, string>,
): IResolvedProofUri[] => (proofs || []).reduce((acc: IResolvedProofUri[], proof) => {
    const uri = mediaMap?.[proof.thumbnailPath || proof.path] || mediaMap?.[proof.path];

    if (uri) {
        acc.push({ id: proof.id, uri, mediaType: proof.mediaType });
    }

    return acc;
}, []);

/**
 * The paths to hand `MapActions.fetchMedia`.
 *
 * A video's thumbnail is requested alongside its source rather than instead of
 * it: the grid shows the thumbnail, and resolving only that would leave nothing
 * to open. Videos cannot be produced by the current proof sheet (it is
 * photo-only), but `habits.proofs` models them and the API returns them, so
 * this handles the row shape rather than the subset today's UI can create.
 */
export const getProofMediaRequests = (
    proofs: IHabitCheckinProof[],
): { path: string; type: string }[] => {
    const seen = new Set<string>();

    return (proofs || []).reduce((acc: { path: string; type: string }[], proof) => {
        [proof.path, proof.thumbnailPath].forEach((path) => {
            if (path && !seen.has(path)) {
                seen.add(path);
                acc.push({ path, type: proof.type });
            }
        });

        return acc;
    }, []);
};
