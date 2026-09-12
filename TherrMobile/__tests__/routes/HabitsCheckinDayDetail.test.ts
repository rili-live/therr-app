import {
    formatDayTitle,
    getProofMediaRequests,
    getStatusLabelKey,
    isDayInFuture,
    resolveProofUris,
} from '../../main/routes/Habits/checkinDayDetail';

/**
 * Presentation logic behind the calendar's day-detail sheet.
 *
 * Kept RN-free so it can be exercised without a renderer, matching
 * `HabitsDashboardPactState` and `JournalFeedGrouping`.
 */

const proof = (overrides: any = {}) => ({
    id: 'proof-1',
    checkinId: 'checkin-1',
    mediaType: 'image' as const,
    path: 'user-1/content/habits_proof_goal-1_1.jpeg',
    type: 'user-image-private',
    thumbnailPath: null,
    createdAt: '2026-08-20T10:00:00.000Z',
    capturedAt: null,
    verificationStatus: null,
    ...overrides,
});

describe('checkinDayDetail', () => {
    describe('formatDayTitle', () => {
        it('builds the title from the locale dictionary, never from Intl', () => {
            // Hermes on Android ships without full ICU for every locale we
            // support, so `toLocaleDateString('fr-ca')` can silently return
            // English. Every name must come through `translate`.
            const seen: string[] = [];
            const translate = (key: string, params?: any) => {
                seen.push(key);
                if (key === 'pages.habits.dayDetail.title') {
                    return `${params.weekday}, ${params.month} ${params.day}`;
                }
                return key.split('.').pop() as string;
            };

            const title = formatDayTitle(new Date(2026, 7, 20), translate);

            expect(seen).toContain('pages.habits.daysOfWeekShort.thu');
            expect(seen).toContain('dateTime.months.august');
            expect(title).toBe('thu, august 20');
        });
    });

    describe('getStatusLabelKey', () => {
        it('returns undefined with no check-in, so the sheet shows its empty state', () => {
            // "No record" and "pending" are different things — showing the
            // latter would tell a user they owe a check-in on a day the habit
            // did not exist.
            expect(getStatusLabelKey(undefined)).toBeUndefined();
        });

        it.each(['completed', 'partial', 'skipped', 'missed', 'pending'])(
            'maps the %s status to its own key',
            (status) => {
                expect(getStatusLabelKey({ status } as any))
                    .toBe(`pages.habits.dayDetail.status.${status}`);
            },
        );

        it('falls back to a generic label rather than rendering an unknown enum value', () => {
            expect(getStatusLabelKey({ status: 'quantum' } as any))
                .toBe('pages.habits.dayDetail.status.recorded');
        });
    });

    describe('isDayInFuture', () => {
        const today = new Date(2026, 7, 20, 14, 30);

        it('is false for today, whatever the time of day', () => {
            expect(isDayInFuture(new Date(2026, 7, 20, 0, 0), today)).toBe(false);
            expect(isDayInFuture(new Date(2026, 7, 20, 23, 59), today)).toBe(false);
        });

        it('is true for tomorrow and false for yesterday', () => {
            expect(isDayInFuture(new Date(2026, 7, 21), today)).toBe(true);
            expect(isDayInFuture(new Date(2026, 7, 19), today)).toBe(false);
        });

        it('handles month and year boundaries', () => {
            expect(isDayInFuture(new Date(2026, 8, 1), new Date(2026, 7, 31))).toBe(true);
            expect(isDayInFuture(new Date(2025, 11, 31), new Date(2026, 0, 1))).toBe(false);
        });
    });

    describe('resolveProofUris', () => {
        it('drops proofs whose media url has not resolved yet', () => {
            // `content.media` fills asynchronously. An <Image> with an
            // undefined uri renders a permanent blank tile and no error, so
            // these count as still-loading rather than as displayable.
            const resolved = resolveProofUris(
                [proof(), proof({ id: 'proof-2', path: 'user-1/content/pending.jpeg' })],
                { 'user-1/content/habits_proof_goal-1_1.jpeg': 'https://cdn/one.jpeg' },
            );

            expect(resolved).toEqual([
                { id: 'proof-1', uri: 'https://cdn/one.jpeg', mediaType: 'image' },
            ]);
        });

        it('prefers a thumbnail url when the proof has one', () => {
            const resolved = resolveProofUris(
                [proof({ mediaType: 'video', thumbnailPath: 'user-1/content/thumb.jpeg' })],
                {
                    'user-1/content/habits_proof_goal-1_1.jpeg': 'https://cdn/video.mp4',
                    'user-1/content/thumb.jpeg': 'https://cdn/thumb.jpeg',
                },
            );

            expect(resolved[0].uri).toBe('https://cdn/thumb.jpeg');
            expect(resolved[0].mediaType).toBe('video');
        });

        it('falls back to the source url when a thumbnail is declared but unresolved', () => {
            const resolved = resolveProofUris(
                [proof({ thumbnailPath: 'user-1/content/thumb.jpeg' })],
                { 'user-1/content/habits_proof_goal-1_1.jpeg': 'https://cdn/one.jpeg' },
            );

            expect(resolved[0].uri).toBe('https://cdn/one.jpeg');
        });

        it('tolerates an absent proof list or media map', () => {
            expect(resolveProofUris([], {})).toEqual([]);
            expect(resolveProofUris(undefined as any, {})).toEqual([]);
            expect(resolveProofUris([proof()], undefined as any)).toEqual([]);
        });
    });

    describe('getProofMediaRequests', () => {
        it('requests both the source and the thumbnail for a video', () => {
            // The grid shows the thumbnail; resolving only that would leave
            // nothing to open.
            expect(getProofMediaRequests([
                proof({ mediaType: 'video', thumbnailPath: 'user-1/content/thumb.jpeg' }),
            ])).toEqual([
                { path: 'user-1/content/habits_proof_goal-1_1.jpeg', type: 'user-image-private' },
                { path: 'user-1/content/thumb.jpeg', type: 'user-image-private' },
            ]);
        });

        it('deduplicates a path shared across proofs', () => {
            expect(getProofMediaRequests([proof(), proof({ id: 'proof-2' })])).toEqual([
                { path: 'user-1/content/habits_proof_goal-1_1.jpeg', type: 'user-image-private' },
            ]);
        });

        it('carries the server-resolved bucket type through untouched', () => {
            // Passing `mediaType` ('image') where `type` belongs makes
            // maps-service resolve against the PUBLIC bucket and fail silently.
            const [request] = getProofMediaRequests([proof()]);

            expect(request.type).toBe('user-image-private');
        });

        it('tolerates an absent proof list', () => {
            expect(getProofMediaRequests(undefined as any)).toEqual([]);
        });
    });
});
