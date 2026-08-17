/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface IVerifyLifetimePurchaseBody {
    /** Only 'android' is supported today; the field exists so iOS can be added without a client change. */
    platform?: 'android';
    productId?: string;
    /** The opaque token the store hands back on a completed purchase. */
    purchaseToken: string;
    orderId?: string;
}

class HabitsLifetimeService {
    /**
     * Founder-offer availability plus this account's own entitlement state.
     * One call, because a paywall that learns "seats left" and "already owned"
     * from two endpoints can render a buy button to someone who already paid.
     */
    getOffer = () => axios({
        method: 'get',
        url: '/users-service/habits/lifetime',
    });

    /**
     * Hand a completed store purchase to the server for verification.
     *
     * The server checks the token against Google Play directly — nothing the
     * client claims about the purchase is trusted — then records it, allocates
     * a founder number and grants the entitlement. Safe to retry: the same
     * token returns the same purchase rather than granting twice.
     */
    verifyPurchase = (data: IVerifyLifetimePurchaseBody) => axios({
        method: 'post',
        url: '/users-service/habits/lifetime/verify',
        data,
    });
}

export default new HabitsLifetimeService();
