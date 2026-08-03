import Store from '../../store';
import { IPactPartnerMember, selectPactPartnerIds } from '../../utilities/pactHelpers';

/**
 * Loads membership for the given pacts (one query) and resolves the
 * deduplicated set of other participants who should hear about `userId`'s
 * activity. See selectPactPartnerIds for the selection rules.
 */
export const resolvePactPartnerIds = async (
    pacts: any[],
    userId: string,
    options: { onlyCelebrating?: boolean } = {},
): Promise<string[]> => {
    if (!pacts.length) {
        return [];
    }

    const members = await Store.pactMembers.getByPactIds(pacts.map((pact) => pact.id));
    const membersByPactId: Record<string, IPactPartnerMember[]> = members.reduce(
        (acc: Record<string, IPactPartnerMember[]>, member: IPactPartnerMember) => {
            acc[member.pactId] = acc[member.pactId] || [];
            acc[member.pactId].push(member);
            return acc;
        },
        {},
    );

    return selectPactPartnerIds(pacts, membersByPactId, userId, options);
};

export default resolvePactPartnerIds;
