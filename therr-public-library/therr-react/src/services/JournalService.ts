/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface ICreateJournalEntryBody {
    body: string;
    habitGoalId?: string | null;
    checkinId?: string | null;
    /**
     * The user's local calendar day, YYYY-MM-DD. Sent by the client because
     * only it knows the device timezone — a note written late at night must
     * file under the day the user experienced, not the server's UTC day.
     */
    entryDate?: string;
    occurredAt?: string;
}

export interface IUpdateJournalEntryBody {
    body?: string;
    /** `null` clears the habit tag; omit the key to leave it unchanged. */
    habitGoalId?: string | null;
}

class JournalService {
    /**
     * The merged feed, newest first. `before` is an exclusive cursor on
     * `occurredAt` — pass the previous response's `nextCursor` rather than an
     * offset, because the feed interleaves five sources and an offset cannot
     * stay stable across them.
     */
    getFeed = (options: { before?: string | null; limit?: number } = {}) => {
        const params = new URLSearchParams();
        if (options.before) params.append('before', options.before);
        if (options.limit) params.append('limit', String(options.limit));
        const queryString = params.toString() ? `?${params.toString()}` : '';

        return axios({
            method: 'get',
            url: `/users-service/habits/journal${queryString}`,
        });
    };

    create = (data: ICreateJournalEntryBody) => axios({
        method: 'post',
        url: '/users-service/habits/journal',
        data,
    });

    update = (id: string, data: IUpdateJournalEntryBody) => axios({
        method: 'put',
        url: `/users-service/habits/journal/${id}`,
        data,
    });

    delete = (id: string) => axios({
        method: 'delete',
        url: `/users-service/habits/journal/${id}`,
    });
}

export default new JournalService();
