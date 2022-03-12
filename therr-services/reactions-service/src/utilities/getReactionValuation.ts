import { CurrentSocialValuations } from 'therr-js-utilities/constants';

// NOTE: offset if already accounted for
export default (existing, reqBody) => {
    let coinValue = 0;

    // Addition
    if (reqBody.userBookmarkCategory && !existing.userBookmarkCategory) {
        coinValue += CurrentSocialValuations.bookmark;
    }
    if (reqBody.userHasLiked && !existing.userHasLiked) {
        coinValue += CurrentSocialValuations.like;
    }
    if (reqBody.userHasSuperLiked && !existing.userHasSuperLiked) {
        coinValue += CurrentSocialValuations.superLike;
    }

    // Reduction
    if (reqBody.userBookmarkCategory === null && existing.userBookmarkCategory) {
        coinValue -= CurrentSocialValuations.bookmark;
    }
    if (reqBody.userHasDisliked && !existing.userHasDisliked) {
        coinValue -= CurrentSocialValuations.like;
    }
    if (reqBody.userHasSuperDisliked && !existing.userHasSuperDisliked) {
        coinValue -= CurrentSocialValuations.superLike;
    }

    return coinValue;
};
