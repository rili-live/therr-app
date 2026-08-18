import { body } from 'express-validator';

/**
 * Start a Stripe Checkout Session for a dashboard plan.
 *
 * Deliberately unauthenticated: the buy-then-register path is a real one, and
 * the Payment Links this replaces were public too. Nothing here grants
 * anything — the resulting session still has to survive
 * `doesSessionEmailMatchAccount` before any access level moves.
 *
 * `plan` and `billingPeriod` are constrained to the known set here so a bad
 * value is a 400 at the edge rather than a Stripe API error deeper in.
 * `cancelPath` is re-sanitized in the users-service, which is the layer that
 * actually interpolates it into a URL.
 */
export const createCheckoutSessionValidation = [
    body('plan').exists().isString().isIn(['basic', 'advanced', 'pro']),
    body('billingPeriod').optional().isString().isIn(['monthly', 'annual']),
    body('cancelPath').optional().isString().isLength({ max: 512 }),
    body('userAcquisition').optional().isObject(),
];

export default createCheckoutSessionValidation;
