import { IJournalFeedItem } from 'therr-react/types';

/**
 * Day-grouping for the journal feed.
 *
 * Deliberately free of React Native imports so it can be unit-tested directly,
 * the same trick `routes/Habits/pactState.ts` uses.
 *
 * The feed arrives already sorted newest-first and already carrying each item's
 * *local* `entryDate` (resolved server-side from the stored calendar day, not
 * from a timestamp). Grouping therefore never re-derives a date — doing so on
 * the client would reintroduce exactly the off-by-one this app has hit twice:
 * a note written at 23:40 belongs to the day the user experienced, not to
 * whatever day its UTC instant lands on.
 */
export interface IJournalDaySection {
    /** YYYY-MM-DD — stable key, safe to use as a list key. */
    entryDate: string;
    /** Month heading, rendered only on the first section of each month. */
    monthLabel: string;
    /** Whether this section opens a new month and should render its heading. */
    isFirstOfMonth: boolean;
    dayOfMonth: string;
    weekdayLabel: string;
    data: IJournalFeedItem[];
}

const MONTH_KEYS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
];

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Parse YYYY-MM-DD without going through `new Date(string)`.
 *
 * `new Date('2026-08-14')` is parsed as UTC midnight and then read back in
 * local time, which lands on the 13th anywhere west of Greenwich. Building the
 * date from its parts keeps it local and correct.
 */
const parseEntryDate = (entryDate: string): Date => {
    const [year, month, day] = entryDate.split('-').map((part) => parseInt(part, 10));
    return new Date(year, (month || 1) - 1, day || 1);
};

export const getMonthKey = (entryDate: string): string => {
    const parsed = parseEntryDate(entryDate);
    return MONTH_KEYS[parsed.getMonth()];
};

export const getWeekdayKey = (entryDate: string): string => {
    const parsed = parseEntryDate(entryDate);
    return WEEKDAY_KEYS[parsed.getDay()];
};

/**
 * Collapse a flat feed into one section per day, newest first.
 *
 * `translate` is injected rather than imported so this stays RN-free and so the
 * month/weekday labels go through the same locale dictionary as the rest of the
 * app — hardcoding English names here is the bug class CLAUDE.md calls out for
 * anything that renders translated text.
 */
export const groupFeedByDay = (
    items: IJournalFeedItem[],
    translate: (key: string, params?: any) => string,
): IJournalDaySection[] => {
    const sections: IJournalDaySection[] = [];
    let lastMonthKey: string | null = null;

    items.forEach((item) => {
        const existing = sections[sections.length - 1];

        if (existing && existing.entryDate === item.entryDate) {
            existing.data.push(item);
            return;
        }

        const parsed = parseEntryDate(item.entryDate);
        const monthKey = MONTH_KEYS[parsed.getMonth()];
        const isFirstOfMonth = monthKey !== lastMonthKey;
        lastMonthKey = monthKey;

        sections.push({
            entryDate: item.entryDate,
            monthLabel: translate(`dateTime.months.${monthKey}`),
            isFirstOfMonth,
            dayOfMonth: String(parsed.getDate()),
            weekdayLabel: translate(`pages.habits.daysOfWeekShort.${WEEKDAY_KEYS[parsed.getDay()]}`),
            data: [item],
        });
    });

    return sections;
};

/**
 * The time chip on each row ("21:14" in the design).
 *
 * Uses `occurredAt`, which is a real instant, so the device's own locale and
 * timezone are the right thing to format it in.
 */
export const formatEntryTime = (occurredAt: string, locale: string): string => {
    const date = new Date(occurredAt);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleTimeString(locale || 'en-us', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};
