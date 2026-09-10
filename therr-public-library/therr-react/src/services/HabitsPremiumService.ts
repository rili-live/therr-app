/* eslint-disable class-methods-use-this */
import axios from 'axios';

export interface IVerifyPremiumPurchaseBody {
    /** Only 'android' is supported today; the field exists so iOS can be added without a client change. */
    platform?: 'android';
    productId?: string;
    /** The opaque token the store hands back on a completed subscription purchase. */
    purchaseToken: string;
    orderId?: string;
}

class HabitsPremiumService {
    /**
     * Premium-tier availability plus this account's own entitlement state. One
     * call, so a paywall that learns "already subscribed" and "product to offer"
     * from two endpoints can never render a buy button to someone who already
     * subscribed.
     */
    getOffer = () => axios({
        method: 'get',
        url: '/users-service/habits/premium',
    });

    /**
     * Hand a completed store subscription purchase to the server for verification.
     *
     * The server checks the token against Google Play directly — nothing the
     * client claims is trusted — then records it and grants the premium
     * entitlement. Safe to retry: the same token updates the same row rather than
     * granting twice.
     */
    verifyPurchase = (data: IVerifyPremiumPurchaseBody) => axios({
        method: 'post',
        url: '/users-service/habits/premium/verify',
        data,
    });
}

export default new HabitsPremiumService();
