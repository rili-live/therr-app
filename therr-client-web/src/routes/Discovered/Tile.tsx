import React, { useState } from "react";

interface MomentProps {
    moment: {
        id: string,
        fromUserName: string,
        message: string
    }
}

const Tile: React.FC<MomentProps> = ({ moment }) => {
    
    const [liked, setLiked] = useState(false);

    const handleLike = () => {
        setLiked(!liked);
    }

    return <div className="tile">
            <p className="tile_username">{moment.fromUserName}</p>
            <img 
                className="tile_image" 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Image_created_with_a_mobile_phone.png/1200px-Image_created_with_a_mobile_phone.png" 
                alt={moment.fromUserName} />
            <div className='tile_lower_content'>
                <p className="tile_message">{moment.message}</p>
                <button className={liked ? "tile_button_liked" : 'tile_button_unliked'} onClick={handleLike}>❤️</button>
            </div>
        </div>
}

export default Tile
