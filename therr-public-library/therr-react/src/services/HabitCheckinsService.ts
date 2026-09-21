/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICheckinProofMedia {
    path: string;
    type?: 'image' | 'video';
    thumbnailPath?: string;
    fileSizeBytes?: number;
    durationSeconds?: number;
}

export interface ICreateCheckinBody {
    pactId?: string;
    habitGoalId: string;
    /**
     * The habit day this check-in is for (YYYY-MM-DD), in the user's **local** calendar —
     * `toLocalDateKey(new Date())`, not `toISOString()`. Omit it for "now" and the server
     * resolves the user's today itself. A date ahead of the user's today (which is what a UTC
     * stamp is, every evening west of UTC) is clamped down to it; earlier dates are honoured,
     * so backdating a missed day still works.
     */
    scheduledDate?: string;
    /**
     * The device's IANA timezone. The server resolves the check-in's dates from the account's
     * saved zone first and falls back to this, which is what makes both streaks count the
     * user's own midnight rather than UTC's.
     */
    timeZone?: string;
    /**
     * The user's calendar day this check-in is for (YYYY-MM-DD). Honoured for today and
     * yesterday only; anything older still counts for the habit but not the daily streak.
     */
    localDate?: string;
    status?: 'pending' | 'completed' | 'partial' | 'skipped' | 'missed';
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
    proofMedias?: ICheckinProofMedia[];
    /**
     * Money this check-in put away, on a `savings_goal` habit. Major units.
     *
     * Three states, and they are not interchangeable — the server reads them as written:
     *
     *   - **absent** — leave any amount already recorded for this day alone. This is what
     *     an "add a note or photo" save must send, or it would erase the money.
     *   - **`null` or `''`** — clear a previously recorded amount.
     *   - **a value** — set it. A repeat submission for the same day overwrites rather
     *     than accumulating, so correcting a mistyped amount does the obvious thing.
     *
     * A string is accepted as well as a number: the server parses it with the shared
     * `parseSavingsAmount`, which is what lets the notification quick-reply post whatever
     * the user typed into a system text field. A client with a form in front of it should
     * still validate with the same helper so it cannot accept what the server rejects.
     */
    savedAmount?: number | string | null;
}

export interface IUpdateCheckinBody {
    status?: 'pending' | 'completed' | 'partial' | 'skipped' | 'missed';
    notes?: string;
    selfRating?: number;
    difficultyRating?: number;
    /** See `ICreateCheckinBody.savedAmount` — same three states, same parsing. */
    savedAmount?: number | string | null;
}

class HabitCheckinsService {
    create = (data: ICreateCheckinBody) => axios({
        method: 'post',
        url: '/users-service/habits/checkins',
        data,
    });

    get = (id: string) => axios({
        method: 'get',
        url: `/users-service/habits/checkins/${id}`,
    });

    /**
     * Proof media attached to one check-in, as `{ proofs: [...] }`.
     *
     * Owner-only, and fetched per check-in rather than with the month range:
     * the calendar renders a badge from the `hasProof` flag it already has, so
     * paths are only requested for a day the user opens. Each proof carries the
     * `path`/`type` pair `MapsService.fetchMedia` expects, so the caller can
     * hand `proofs` straight to it to resolve displayable URLs.
     */
    getProofs = (checkinId: string) => axios({
        method: 'get',
        url: `/users-service/habits/checkins/${checkinId}/proofs`,
    });

    /**
     * Today's check-ins, where "today" is the user's own calendar day — the same day the
     * create path stamps on `scheduledDate`. Pass the device zone so a user whose account has
     * no saved `settingsTimezone` still gets their day rather than the service fallback's.
     */
    getTodayCheckins = (habitGoalId?: string, timeZone?: string) => {
        const params = new URLSearchParams();
        if (habitGoalId) params.append('habitGoalId', habitGoalId);
        if (timeZone) params.append('timeZone', timeZone);
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/checkins/today${queryString}`,
        });
    };

    getByDateRange = (startDate: string, endDate: string, habitGoalId?: string) => {
        const params = new URLSearchParams();
        params.append('startDate', startDate);
        params.append('endDate', endDate);
        if (habitGoalId) params.append('habitGoalId', habitGoalId);

        return axios({
            method: 'get',
            url: `/users-service/habits/checkins/range?${params.toString()}`,
        });
    };

    getPactCheckins = (pactId: string, limit?: number, offset?: number) => {
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (offset) params.append('offset', offset.toString());
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/checkins/pact/${pactId}${queryString}`,
        });
    };

    /**
     * Share a check-in's proof photo publicly as a post (main.thoughts).
     *
     * The backend copies the private proof image into the public bucket, moderates the copy,
     * creates a public thought carrying it, and records the link on the check-in. Idempotent:
     * a check-in that is already shared returns `{ sharedThoughtId, alreadyShared: true }`
     * without creating a second post. `message` is an optional lead-in for the post.
     */
    share = (id: string, message?: string) => axios({
        method: 'post',
        url: `/users-service/habits/checkins/${id}/share`,
        data: { message },
    });

    update = (id: string, data: IUpdateCheckinBody) => axios({
        method: 'put',
        url: `/users-service/habits/checkins/${id}`,
        data,
    });

    skip = (id: string, notes?: string) => axios({
        method: 'put',
        url: `/users-service/habits/checkins/${id}/skip`,
        data: { notes },
    });

    delete = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/checkins/${id}`,
    });
}

export default new HabitCheckinsService();
