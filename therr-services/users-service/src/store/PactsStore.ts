import KnexBuilder, { Knex } from 'knex';
import { IConnection } from './connection';
import { PACTS_TABLE_NAME, HABIT_GOALS_TABLE_NAME, PACT_MEMBERS_TABLE_NAME } from './tableNames';

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
}

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
