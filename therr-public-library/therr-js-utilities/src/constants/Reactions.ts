/**
 * Bounds for the client-supplied numeric fields on reaction create/update.
 *
 * These live here rather than in either consumer because both the API gateway
 * (which rejects out-of-range values with a 400) and reactions-service (which
 * re-checks, since its internal /create-update/multiple routes are not exposed
 * through the gateway and therefore never see that validation) have to agree on
 * them. A divergence between the two is the exact failure this guards against.
 *
 * Every column below is a Postgres `integer`, so the bounds also keep the
 * additive `userViewCount` well clear of int4 overflow.
 */

// Clients send `userViewCount: 1` per view (TherrMapView.tsx). The ceiling is
// deliberately far above real traffic — it exists to stop a single request from
// adding an arbitrary amount to the running total, not to police normal use.
const USER_VIEW_COUNT_MIN = 0;
const USER_VIEW_COUNT_MAX = 100;

// Bookmark ordering hint. No client sets it today; the column defaults to 0.
const USER_BOOKMARK_PRIORITY_MIN = 0;
const USER_BOOKMARK_PRIORITY_MAX = 100;

// Space/event star rating. The UI is a 1-5 picker (Input/SpaceRating.tsx) and
// the value is averaged into the rating shown on public space pages, so an
// out-of-range value permanently skews a number real businesses are judged on.
const RATING_MIN = 1;
const RATING_MAX = 5;

export default {
    USER_VIEW_COUNT_MIN,
    USER_VIEW_COUNT_MAX,
    USER_BOOKMARK_PRIORITY_MIN,
    USER_BOOKMARK_PRIORITY_MAX,
    RATING_MIN,
    RATING_MAX,
};
