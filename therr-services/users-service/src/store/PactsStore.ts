import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import {
    PACTS_TABLE_NAME,
    HABIT_GOALS_TABLE_NAME,
    PACT_JOIN_REQUESTS_TABLE_NAME,
    PACT_MEMBERS_TABLE_NAME,
    USERS_TABLE_NAME,
} from './tableNames';
import {
    IHabitMatchKey,
    JOINABLE_PACT_STATUSES,
    MAX_OPEN_PACT_MEMBERS,
    OPEN_PACTS_LIST_LIMIT,
} from '../utilities/openPacts';

const knexBuilder: Knex = KnexBuilder({ client: 'pg' });

export interface ICreatePactParams {
    creatorUserId: string;
    partnerUserId?: string;
    habitGoalId: string;
    pactType?: string;
    durationDays?: number;
    startDate?: Date;
    endDate?: Date;
    consequenceType?: string;
    consequenceDetails?: object;
    /** The pact this one continues — set only by the renew path. */
    renewedFromPactId?: string;
    /** 1 for a first cycle; the predecessor's value plus one for a renewal. */
    renewalCycleNumber?: number;
    /** Whether people outside the pact may ask to join it. See utilities/openPacts.ts. */
    isOpen?: boolean;
}

/**
 * A renewal that has not been walked away from.
 *
 * `abandoned` is the one status that un-supersedes a predecessor: declining a 1:1 renewal
 * invite abandons it (see handlers/pacts.ts § declinePact), and the cycle it continued must
 * come back into the list with its re-commit CTA rather than staying hidden behind a pact
 * that will never run. Every other status — including `expired`, a cycle that ran and
 * finished — means the predecessor is genuinely history.
 */
const LIVE_SUCCESSOR_STATUSES = ['pending', 'active', 'completed', 'expired'];

/**
 * `supersededByPactId` — the newest cycle that continues this pact, or null.
 *
 * Derived rather than stored. The forward edge is what the list filter and the "continued
 * as" link both key off, and keeping it as a second column on the parent would mean two
 * writes that can disagree about the same fact — on the very row a concurrent double-tap of
 * re-commit races on. The subquery is index-backed
 * (`idx_pacts_renewed_from_pact_id`) and single-valued, which a LEFT JOIN would not be: a
 * pact whose first renewal was declined and then renewed again has two successor rows, and
 * joining would silently double that pact's row in every list.
 */
const supersededByPactIdSelect = () => knexBuilder.raw(
    `(SELECT successor."id" FROM ${PACTS_TABLE_NAME} AS successor`
    + ` WHERE successor."renewedFromPactId" = ${PACTS_TABLE_NAME}."id"`
    + ` AND successor."status" IN (${LIVE_SUCCESSOR_STATUSES.map(() => '?').join(', ')})`
    + ' ORDER BY successor."createdAt" DESC LIMIT 1) as "supersededByPactId"',
    LIVE_SUCCESSOR_STATUSES,
);

export interface IUpdatePactParams {
    partnerUserId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    consequenceType?: string;
    consequenceDetails?: object;
    endReason?: string;
    winnerId?: string;
    creatorCompletionRate?: number;
    partnerCompletionRate?: number;
    currentPactStreak?: number;
    longestPactStreak?: number;
    lastPactStreakDate?: string;
    isSolo?: boolean;
    isOpen?: boolean;
}

/**
 * One open pact as a prospective member sees it — enough to decide whether to ask, and nothing
 * about the members beyond how many there are. See `getOpenPacts`.
 */
export interface IOpenPactRow {
    id: string;
    status: string;
    habitGoalId: string;
    durationDays: number;
    startDate: Date | null;
    endDate: Date | null;
    createdAt: Date;
    creatorUserId: string;
    creatorUserName: string;
    habitGoalName: string;
    habitGoalEmoji: string | null;
    habitGoalCategory: string | null;
    habitGoalFrequencyType: string | null;
    habitGoalFrequencyCount: number | null;
    memberCount: number;
    hasPendingJoinRequest: boolean;
}

/**
 * One unanswered pact the open-pact suggestion pass may prompt about, with what the prompt needs
 * about its creator. See `getStalePendingForOpenSuggestion`.
 */
export interface IStalePendingPactRow {
    pactId: string;
    creatorUserId: string;
    habitGoalId: string;
    habitGoalName: string;
    templateKey: string | null;
    sourceTemplateKey: string | null;
    userName: string | null;
    firstName: string | null;
    email: string | null;
    isUnclaimed: boolean | null;
    settingsEmailReminders: boolean | null;
    settingsLocale: string | null;
}

// A pact's occupied seats: every member who is in it or has been asked and not yet answered. Left,
// removed and declined members free their seat.
const seatCountSql = () => `(SELECT COUNT(*) FROM ${PACT_MEMBERS_TABLE_NAME} AS seat`
    + ` WHERE seat."pactId" = ${PACTS_TABLE_NAME}."id" AND seat."status" IN ('pending', 'active'))`;

// Must stay the SQL twin of `normalizeHabitName` in utilities/openPacts.ts.
const normalizedGoalNameSql = () => `LOWER(REGEXP_REPLACE(TRIM(${HABIT_GOALS_TABLE_NAME}."name"), '\\s+', ' ', 'g'))`;

export default class PactsStore {
    db: IConnection;

    constructor(dbConnection: IConnection) {
        this.db = dbConnection;
    }

    get(conditions: any, orderBy?: string, limit?: number, offset?: number) {
        let queryString = knexBuilder
            .from(PACTS_TABLE_NAME)
            .where(conditions);

        if (orderBy) {
            queryString = queryString.orderBy(orderBy, 'desc');
        }

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getById(id: string) {
        return this.get({ id }).then((results) => results[0]);
    }

    getByIdWithDetails(id: string) {
        const queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                `${HABIT_GOALS_TABLE_NAME}.category as habitGoalCategory`,
                `${HABIT_GOALS_TABLE_NAME}.frequencyType as habitGoalFrequencyType`,
                `${HABIT_GOALS_TABLE_NAME}.frequencyCount as habitGoalFrequencyCount`,
                // So the pact screen knows to offer an amount field without a goal fetch.
                `${HABIT_GOALS_TABLE_NAME}.amountUnit as habitGoalAmountUnit`,
                supersededByPactIdSelect(),
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .where(`${PACTS_TABLE_NAME}.id`, id);

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows[0]);
    }

    /**
     * The pacts a user can see, newest first.
     *
     * `includeSuperseded` defaults to false, which is the whole reason the renewal lineage
     * exists. A renewal is a new row on the same habit goal, so before this the list showed
     * every cycle a user had ever run side by side — and a re-commit read as the app having
     * duplicated the pact rather than continued it. The predecessor is reachable from its
     * successor's "extended from" link instead; pass `includeSuperseded` for the history
     * view that wants the whole chain.
     */
    getByUserId(userId: string, status?: string, limit?: number, offset?: number, includeSuperseded = false) {
        // Membership is the source of truth: a user "is in" a pact if they
        // appear in pact_members. Falls back to creator/partnerUserId on
        // pacts for any historical pact whose member rows are missing.
        let queryString = knexBuilder
            .distinct([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                `${HABIT_GOALS_TABLE_NAME}.category as habitGoalCategory`,
                supersededByPactIdSelect(),
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .where((builder) => {
                builder.where(`${PACTS_TABLE_NAME}.creatorUserId`, userId)
                    .orWhere(`${PACTS_TABLE_NAME}.partnerUserId`, userId)
                    .orWhereNotNull(`${PACT_MEMBERS_TABLE_NAME}.id`);
            })
            .orderBy(`${PACTS_TABLE_NAME}.createdAt`, 'desc');

        if (status) {
            queryString = queryString.andWhere(`${PACTS_TABLE_NAME}.status`, status);
        }

        // Superseded cycles are excluded here rather than filtered after the read, so
        // `limit`/`offset` page over what the caller actually gets back. Filtering a page
        // afterwards returns short pages and makes "load more" skip rows.
        if (!includeSuperseded) {
            queryString = queryString.andWhereRaw(
                `NOT EXISTS (SELECT 1 FROM ${PACTS_TABLE_NAME} AS successor`
                + ` WHERE successor."renewedFromPactId" = ${PACTS_TABLE_NAME}."id"`
                + ` AND successor."status" IN (${LIVE_SUCCESSOR_STATUSES.map(() => '?').join(', ')}))`,
                LIVE_SUCCESSOR_STATUSES,
            );
        }

        if (limit) {
            queryString = queryString.limit(limit);
        }

        if (offset) {
            queryString = queryString.offset(offset);
        }

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getActivePactsByUserId(userId: string) {
        return this.getByUserId(userId, 'active');
    }

    /**
     * The active pacts a user's check-in on a given habit goal counts toward.
     *
     * Clients log a check-in against a habit goal, never a pact — the pact is
     * a property of the goal — so this is how the check-in flow finds the
     * pacts to credit and the partners to notify. A goal can back more than
     * one active pact (a group pact plus a 1:1, say), hence the plural.
     *
     * Membership is the source of truth, with the same creator/partner
     * fallback as getByUserId — but only for 1:1 pacts that pre-date
     * pact_members and so have no member row to consult. Where a member row
     * does exist it decides on its own, because the creator/partner columns
     * outlive membership: declining an already-active 1:1 pact marks the
     * member `left` while `pacts.partnerUserId` keeps pointing at them, and
     * consulting the column as an alternative would go on crediting their
     * check-ins to the pact they left (and pushing "your partner checked in"
     * to the creator). The join is already scoped to this user, so a null
     * member id means "no row for them", not "no rows at all".
     *
     * Ordered by startDate so callers that must pick a single pact (the
     * singular habit_checkins.pactId column) pick deterministically.
     *
     * "Active" means the cycle is genuinely still running, not merely that the
     * status column says `active`. Nothing closed a finished pact until the
     * habits digest gained its expiry sweep, and even now the sweep runs
     * nightly, so a pact sits `active` for up to a day after its endDate has
     * passed. Without the date predicate that window leaks a finished pact back
     * to every caller: renewal refused it as a still-live cycle, and a check-in
     * logged the morning after a pact ended was attributed to it. The predicate
     * makes the read agree with the state the sweep will put the row in anyway.
     *
     * A null endDate is treated as still running, matching `shouldExpirePact` —
     * an open-ended pact has no cycle to have finished.
     */
    getActiveByUserAndHabitGoal(userId: string, habitGoalId: string) {
        const queryString = knexBuilder
            .distinct(`${PACTS_TABLE_NAME}.*`)
            .from(PACTS_TABLE_NAME)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .where(`${PACTS_TABLE_NAME}.habitGoalId`, habitGoalId)
            .andWhere(`${PACTS_TABLE_NAME}.status`, 'active')
            .andWhere((builder) => {
                builder.where(`${PACT_MEMBERS_TABLE_NAME}.status`, 'active')
                    .orWhere((legacy) => {
                        legacy.whereNull(`${PACT_MEMBERS_TABLE_NAME}.id`)
                            .andWhere((participant) => {
                                participant.where(`${PACTS_TABLE_NAME}.creatorUserId`, userId)
                                    .orWhere(`${PACTS_TABLE_NAME}.partnerUserId`, userId);
                            });
                    });
            })
            .andWhere((builder) => {
                builder.whereNull(`${PACTS_TABLE_NAME}.endDate`)
                    .orWhere(`${PACTS_TABLE_NAME}.endDate`, '>', new Date());
            })
            .orderBy(`${PACTS_TABLE_NAME}.startDate`, 'asc');

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    /**
     * The cycle that already continues `pactId`, if one does.
     *
     * This is the check that makes re-commit idempotent. The "one live pact per habit goal"
     * guard cannot do that job on its own, because a renewal with partners is created
     * `pending` and only activates on the first acceptance — so it is invisible to any
     * predicate keyed on `status = 'active'`, and every further tap on the ended pact's CTA
     * created another parallel pending cycle. Which is exactly what the bug report described:
     * one tap per apparent duplicate.
     *
     * Newest first, and `abandoned` successors are skipped (see LIVE_SUCCESSOR_STATUSES), so
     * a renewal the partner declined leaves the predecessor renewable again.
     */
    getLatestRenewalOf(pactId: string) {
        const queryString = knexBuilder
            .from(PACTS_TABLE_NAME)
            .where('renewedFromPactId', pactId)
            .whereIn('status', LIVE_SUCCESSOR_STATUSES)
            .orderBy('createdAt', 'desc')
            .limit(1);

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows[0]);
    }

    /**
     * Every cycle on a habit goal that has not finished — `pending` invites included.
     *
     * Deliberately separate from `getActiveByUserAndHabitGoal` rather than a flag on it.
     * That method answers "which pacts does this check-in credit", and a pending pact must
     * never be one of them; this one answers "is there already a cycle in flight for this
     * habit", where a pending renewal counts for as much as a running one. Sharing a
     * predicate between the two questions is how one of them ends up wrong.
     */
    getUnfinishedByUserAndHabitGoal(userId: string, habitGoalId: string) {
        const queryString = knexBuilder
            .distinct(`${PACTS_TABLE_NAME}.*`)
            .from(PACTS_TABLE_NAME)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .where(`${PACTS_TABLE_NAME}.habitGoalId`, habitGoalId)
            .whereIn(`${PACTS_TABLE_NAME}.status`, ['pending', 'active'])
            .andWhere((builder) => {
                // Same membership rule as getActiveByUserAndHabitGoal: a member row decides
                // on its own where one exists, and the creator/partner columns are consulted
                // only for 1:1 pacts that pre-date pact_members. A `pending` member row
                // counts here — an unanswered invite is a cycle in flight.
                builder.whereIn(`${PACT_MEMBERS_TABLE_NAME}.status`, ['pending', 'active'])
                    .orWhere((legacy) => {
                        legacy.whereNull(`${PACT_MEMBERS_TABLE_NAME}.id`)
                            .andWhere((participant) => {
                                participant.where(`${PACTS_TABLE_NAME}.creatorUserId`, userId)
                                    .orWhere(`${PACTS_TABLE_NAME}.partnerUserId`, userId);
                            });
                    });
            })
            .andWhere((builder) => {
                builder.whereNull(`${PACTS_TABLE_NAME}.endDate`)
                    .orWhere(`${PACTS_TABLE_NAME}.endDate`, '>', new Date());
            })
            .orderBy(`${PACTS_TABLE_NAME}.createdAt`, 'asc');

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getPendingInvitesForUser(userId: string) {
        // 1:1 invites match on pacts.partnerUserId; group invites match on a
        // pact_members row with role=partner, status=pending. The pact
        // itself may already be 'active' if another invitee accepted first.
        const queryString = knexBuilder
            .distinct([
                `${PACTS_TABLE_NAME}.*`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
            ])
            .from(PACTS_TABLE_NAME)
            .leftJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .leftJoin(PACT_MEMBERS_TABLE_NAME, function joinMembers() {
                this.on(`${PACT_MEMBERS_TABLE_NAME}.pactId`, '=', `${PACTS_TABLE_NAME}.id`)
                    .andOn(`${PACT_MEMBERS_TABLE_NAME}.userId`, '=', knexBuilder.raw('?', [userId]));
            })
            .where((builder) => {
                builder.where((b1) => {
                    b1.where(`${PACTS_TABLE_NAME}.partnerUserId`, userId)
                        .andWhere(`${PACTS_TABLE_NAME}.status`, 'pending');
                }).orWhere((b2) => {
                    b2.where(`${PACT_MEMBERS_TABLE_NAME}.userId`, userId)
                        .andWhere(`${PACT_MEMBERS_TABLE_NAME}.role`, 'partner')
                        .andWhere(`${PACT_MEMBERS_TABLE_NAME}.status`, 'pending')
                        .whereIn(`${PACTS_TABLE_NAME}.status`, ['pending', 'active']);
                });
            })
            .orderBy(`${PACTS_TABLE_NAME}.createdAt`, 'desc');

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    getExpiredPacts() {
        const queryString = knexBuilder
            .from(PACTS_TABLE_NAME)
            .where('status', 'active')
            .andWhere('endDate', '<', new Date());

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows);
    }

    create(params: ICreatePactParams) {
        const endDate = params.endDate || (params.startDate
            ? new Date(new Date(params.startDate).getTime() + (params.durationDays || 30) * 24 * 60 * 60 * 1000)
            : null);

        const queryString = knexBuilder
            .insert({
                ...params,
                pactType: params.pactType || 'accountability',
                durationDays: params.durationDays || 30,
                endDate,
                consequenceDetails: params.consequenceDetails ? JSON.stringify(params.consequenceDetails) : null,
            })
            .into(PACTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    update(id: string, params: IUpdatePactParams) {
        const modifiedParams: any = { ...params };

        if (params.consequenceDetails) {
            modifiedParams.consequenceDetails = JSON.stringify(params.consequenceDetails);
        }

        const queryString = knexBuilder
            .where({ id })
            .update({
                ...modifiedParams,
                updatedAt: new Date(),
            })
            .into(PACTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }

    activate(id: string, startDate?: Date) {
        const start = startDate || new Date();
        const pactPromise = this.getById(id);

        return pactPromise.then((pact) => {
            if (!pact) {
                return null;
            }

            const endDate = new Date(start.getTime() + pact.durationDays * 24 * 60 * 60 * 1000);

            return this.update(id, {
                status: 'active',
                startDate: start,
                endDate,
            });
        });
    }

    complete(id: string, winnerId?: string, creatorCompletionRate?: number, partnerCompletionRate?: number) {
        return this.update(id, {
            status: 'completed',
            endReason: 'completed',
            winnerId,
            creatorCompletionRate,
            partnerCompletionRate,
        });
    }

    abandon(id: string, abandoningUserId: string, isCreator: boolean) {
        return this.update(id, {
            status: 'abandoned',
            endReason: isCreator ? 'abandoned_creator' : 'abandoned_partner',
        });
    }

    expire(id: string) {
        return this.update(id, {
            status: 'expired',
            endReason: 'expired',
        });
    }

    /**
     * Write the derived shared-streak counters after a day is credited. Kept separate from the
     * general `update` so the check-in path expresses intent ("advance the pact streak") rather
     * than assembling a column bag, and so a streak write never accidentally rides along with a
     * status/completion update.
     */
    updatePactStreak(
        id: string,
        params: { currentPactStreak: number; longestPactStreak: number; lastPactStreakDate: string },
    ) {
        return this.update(id, params);
    }

    /**
     * Convert an active pact to solo — the last remaining member chose to continue alone. The
     * pact stays `active` with its one member; `isSolo` is what distinguishes it from a group
     * pact still waiting on partners to accept.
     */
    setSolo(id: string) {
        return this.update(id, { isSolo: true });
    }

    setOpen(id: string, isOpen: boolean) {
        return this.update(id, { isOpen });
    }

    /**
     * Open pacts someone outside them could ask to join, optionally only those on the same habit as
     * `matchKey` (see `getHabitMatchKey`). Never the viewer's own, never one they are already in or
     * invited to, never a full or finished one, never one whose creator deleted their account.
     *
     * `hasPendingJoinRequest` is the viewer's own request state, so the list can show "Requested"
     * instead of offering the button twice.
     */
    getOpenPacts(viewerUserId: string, matchKey?: IHabitMatchKey, limit = OPEN_PACTS_LIST_LIMIT): Promise<IOpenPactRow[]> {
        let queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.id`,
                `${PACTS_TABLE_NAME}.status`,
                `${PACTS_TABLE_NAME}.habitGoalId`,
                `${PACTS_TABLE_NAME}.durationDays`,
                `${PACTS_TABLE_NAME}.startDate`,
                `${PACTS_TABLE_NAME}.endDate`,
                `${PACTS_TABLE_NAME}.createdAt`,
                `${PACTS_TABLE_NAME}.creatorUserId`,
                `${USERS_TABLE_NAME}.userName as creatorUserName`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.emoji as habitGoalEmoji`,
                `${HABIT_GOALS_TABLE_NAME}.category as habitGoalCategory`,
                `${HABIT_GOALS_TABLE_NAME}.frequencyType as habitGoalFrequencyType`,
                `${HABIT_GOALS_TABLE_NAME}.frequencyCount as habitGoalFrequencyCount`,
                knexBuilder.raw(`${seatCountSql()} as "memberCount"`),
                knexBuilder.raw(
                    `EXISTS (SELECT 1 FROM ${PACT_JOIN_REQUESTS_TABLE_NAME} AS jr`
                    + ` WHERE jr."pactId" = ${PACTS_TABLE_NAME}."id" AND jr."requesterUserId" = ? AND jr."status" = 'pending')`
                    + ' as "hasPendingJoinRequest"',
                    [viewerUserId],
                ),
            ])
            .from(PACTS_TABLE_NAME)
            .innerJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .innerJoin(USERS_TABLE_NAME, `${PACTS_TABLE_NAME}.creatorUserId`, `${USERS_TABLE_NAME}.id`)
            .where(`${PACTS_TABLE_NAME}.isOpen`, true)
            .whereIn(`${PACTS_TABLE_NAME}.status`, JOINABLE_PACT_STATUSES)
            .andWhere((builder) => {
                builder.whereNull(`${PACTS_TABLE_NAME}.endDate`)
                    .orWhere(`${PACTS_TABLE_NAME}.endDate`, '>', new Date());
            })
            .andWhereNot(`${PACTS_TABLE_NAME}.creatorUserId`, viewerUserId)
            .andWhere((builder) => {
                builder.where(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`, false)
                    .orWhereNull(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`);
            })
            .andWhereRaw(
                `NOT EXISTS (SELECT 1 FROM ${PACT_MEMBERS_TABLE_NAME} AS mine`
                + ` WHERE mine."pactId" = ${PACTS_TABLE_NAME}."id" AND mine."userId" = ? AND mine."status" IN ('pending', 'active'))`,
                [viewerUserId],
            )
            .andWhereRaw(`${seatCountSql()} < ?`, [MAX_OPEN_PACT_MEMBERS]);

        if (matchKey) {
            const { templateKey, normalizedName } = matchKey;
            if (!templateKey && !normalizedName) {
                return Promise.resolve([]);
            }
            queryString = queryString.andWhere((builder) => {
                if (templateKey) {
                    builder.where(`${HABIT_GOALS_TABLE_NAME}.templateKey`, templateKey)
                        .orWhere(`${HABIT_GOALS_TABLE_NAME}.sourceTemplateKey`, templateKey);
                }
                if (normalizedName) {
                    builder.orWhereRaw(`${normalizedGoalNameSql()} = ?`, [normalizedName]);
                }
            });
        }

        queryString = queryString
            .orderBy(`${PACTS_TABLE_NAME}.updatedAt`, 'desc')
            .limit(Math.max(1, Math.min(limit, OPEN_PACTS_LIST_LIMIT)));

        return this.db.read.query(queryString.toString())
            .then((response) => response.rows.map((row: any) => ({
                ...row,
                memberCount: parseInt(row.memberCount ?? '0', 10),
                hasPendingJoinRequest: !!row.hasPendingJoinRequest,
            })));
    }

    /** Occupied seats on one pact — see `seatCountSql`. Checked again at approval time. */
    countSeats(id: string): Promise<number> {
        const queryString = knexBuilder
            .from(PACT_MEMBERS_TABLE_NAME)
            .where({ pactId: id })
            .whereIn('status', ['pending', 'active'])
            .count('id as count')
            .toString();

        return this.db.read.query(queryString)
            .then((response) => parseInt(response.rows[0]?.count ?? '0', 10));
    }

    /**
     * First-cycle pacts nobody has accepted, created inside the suggestion window, that have not
     * been prompted about yet — the population of the digest's open-pact suggestion pass.
     *
     * `status = 'pending'` already means no invitee accepted (the first acceptance activates the
     * pact); the EXISTS keeps out a pending pact with no invitees left to wait on. Renewals are
     * excluded: their invitees are past partners, a different situation from strangers who never
     * answered.
     */
    getStalePendingForOpenSuggestion(createdBefore: Date, createdAfter: Date, limit: number): Promise<IStalePendingPactRow[]> {
        const queryString = knexBuilder
            .select([
                `${PACTS_TABLE_NAME}.id as pactId`,
                `${PACTS_TABLE_NAME}.creatorUserId`,
                `${PACTS_TABLE_NAME}.habitGoalId`,
                `${HABIT_GOALS_TABLE_NAME}.name as habitGoalName`,
                `${HABIT_GOALS_TABLE_NAME}.templateKey`,
                `${HABIT_GOALS_TABLE_NAME}.sourceTemplateKey`,
                `${USERS_TABLE_NAME}.userName`,
                `${USERS_TABLE_NAME}.firstName`,
                `${USERS_TABLE_NAME}.email`,
                `${USERS_TABLE_NAME}.isUnclaimed`,
                `${USERS_TABLE_NAME}.settingsEmailReminders`,
                `${USERS_TABLE_NAME}.settingsLocale`,
            ])
            .from(PACTS_TABLE_NAME)
            .innerJoin(HABIT_GOALS_TABLE_NAME, `${PACTS_TABLE_NAME}.habitGoalId`, `${HABIT_GOALS_TABLE_NAME}.id`)
            .innerJoin(USERS_TABLE_NAME, `${PACTS_TABLE_NAME}.creatorUserId`, `${USERS_TABLE_NAME}.id`)
            .where(`${PACTS_TABLE_NAME}.status`, 'pending')
            .whereNull(`${PACTS_TABLE_NAME}.renewedFromPactId`)
            .whereNull(`${PACTS_TABLE_NAME}.openSuggestionSentAt`)
            .andWhere(`${PACTS_TABLE_NAME}.createdAt`, '<=', createdBefore)
            .andWhere(`${PACTS_TABLE_NAME}.createdAt`, '>=', createdAfter)
            .andWhere((builder) => {
                builder.where(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`, false)
                    .orWhereNull(`${USERS_TABLE_NAME}.settingsIsAccountSoftDeleted`);
            })
            .andWhereRaw(
                `EXISTS (SELECT 1 FROM ${PACT_MEMBERS_TABLE_NAME} AS invitee`
                + ` WHERE invitee."pactId" = ${PACTS_TABLE_NAME}."id" AND invitee."role" = 'partner' AND invitee."status" = 'pending')`,
            )
            .orderBy(`${PACTS_TABLE_NAME}.createdAt`, 'asc')
            .limit(Math.max(1, limit))
            .toString();

        return this.db.read.query(queryString).then((response) => response.rows);
    }

    /**
     * Claims the once-per-pact open-pact suggestion. Conditional on it being unclaimed, so two
     * overlapping digest runs cannot both send; the loser gets false. Claimed *before* sending —
     * a crash between claim and send costs one suggestion, which is the right way round for a
     * nice-to-have prompt.
     */
    claimOpenSuggestion(id: string): Promise<boolean> {
        const queryString = knexBuilder
            .where({ id })
            .whereNull('openSuggestionSentAt')
            .update({ openSuggestionSentAt: new Date() })
            .into(PACTS_TABLE_NAME)
            .returning('id')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows.length > 0);
    }

    delete(id: string, userId: string) {
        // Only allow deletion of pending pacts by creator
        const queryString = knexBuilder
            .where({ id, creatorUserId: userId, status: 'pending' })
            .delete()
            .into(PACTS_TABLE_NAME)
            .returning('*')
            .toString();

        return this.db.write.query(queryString).then((response) => response.rows[0]);
    }
}
