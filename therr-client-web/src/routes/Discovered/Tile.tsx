import React from 'react';
import { useSelector } from 'react-redux';
import { SvgButton } from 'therr-react/components';

interface MomentProps {
    area: any;
    updateAreaReaction: any;
    userDetails: any;
}

const Tile: React.FC<MomentProps> = ({ area, updateAreaReaction, userDetails }: MomentProps) => {
    const content: any = useSelector((state: any) => state.content);
    const isBookmarked = area.reaction?.userBookmarkCategory;
    const isLiked = area.reaction?.userHasLiked;

    const onBookmarkPress = () => {
        updateAreaReaction(area.id, {
            userBookmarkCategory: area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        }, area.fromUserId, userDetails.userName);
    };

    const onLikePress = () => {
        if (!area.isDraft) {
            updateAreaReaction(area.id, {
                userHasLiked: !area.reaction?.userHasLiked,
            }, area.fromUserId, userDetails.userName);
        }
    };

    return (
        <div className='tile_wrapper'>
            <div className="tile">
                <p className="tile-username">{area.fromUserName}</p>
                {area.media.length > 0
                && <img
                    className="tile-image"
                    src={content.media?.[area.medias?.[0]?.path]}
                    alt={area.fromUserName}
                />}
                <div className='tile-lower-content'>
                    <p className="tile-title">{area.notificationMsg}</p>
                    <SvgButton
                        id="bookmark_button"
                        name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                        className={isBookmarked ? 'tile-button-bookmarked' : 'tile-button-unbookmarked'}
                        onClick={onBookmarkPress}
                        buttonType="primary"
                    />
                    <SvgButton
                        id="like_button"
                        name={isLiked ? 'favorite' : 'favorite-border'}
                        className={isLiked ? 'tile-button-liked' : 'tile-button-unliked'}
                        onClick={onLikePress}
                        buttonType="primary"
                    />
                </div>
                <p className="tile-message">{area.message}</p>
            </div>
        </div>
    );
};

export default Tile;
