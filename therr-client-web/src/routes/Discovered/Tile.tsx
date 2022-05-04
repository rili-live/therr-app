import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from 'axios'

interface MomentProps {
    moment: {
        id: string,
        fromUserName: string,
        message: string,
        media: [{
            id: string
        }],
    }
}

const Tile: React.FC<MomentProps> = ({ moment }) => {
    
    const [liked, setLiked] = useState(false);

    const content: any = useSelector((state: any) => state.content)

    const handleLike = () => {
        setLiked(!liked);
    }

    return <div className="tile">
            <p className="tile_username">{moment.fromUserName}</p>
            {moment.media.length > 0 && <img 
                className="tile_image" 
                // src={content.media[moment.media[0].id]}
                src={content.media[moment.media[0].id]}
                alt={moment.fromUserName} />}
            <div className='tile_lower_content'>
                <p className="tile_message">{moment.message}</p>
                <button className={liked ? "tile_button_liked" : 'tile_button_unliked'} onClick={handleLike}>❤️</button>
            </div>
        </div>
}

export default Tile
