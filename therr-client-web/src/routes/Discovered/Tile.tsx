import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { SvgButton } from 'therr-react/components';

interface MomentProps {
    moment: {
        id: string,
        fromUserName: string,
        message: string,
        media: [{
            id: string
        }],
        notificationMsg: string,
    }
}

const Tile: React.FC<MomentProps> = ({ moment }: MomentProps) => {
    const [liked, setLiked] = useState(false);

    const content: any = useSelector((state: any) => state.content);

    const handleLike = () => {
        setLiked(!liked);
    };

    return (
        <div className="tile">
            <p className="tile-username">{moment.fromUserName}</p>
            {moment.media.length > 0
            && <img
                className="tile-image"
                // src={content.media[moment.media[0].id]}
                src={content.media[moment.media[0].id]}
                alt={moment.fromUserName}
            />}
            <div className='tile-lower-content'>
                <p className="tile-title">{moment.notificationMsg}</p>
                <SvgButton
                    id="like_button"
                    name={liked ? 'favorite' : 'favorite-border'}
                    className={liked ? 'tile-button-liked' : 'tile-button-unliked'}
                    onClick={handleLike}
                    buttonType="primary"
                />
            </div>
            <p className="tile-message">{moment.message}</p>
        </div>
    );
};

export default Tile;
