import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { faStar as farStar } from '@fortawesome/free-regular-svg-icons';

interface StarRatingProps {
  maxStars?: number;
  value: number;
}

const StarRating: React.FC<StarRatingProps> = ({
    maxStars = 5,
    value,
}) => {
    const renderStar = (starValue: number) => {
        const isFilled = starValue <= value;
        const icon = isFilled ? faStar : farStar;

        return (
            <FontAwesomeIcon
                key={starValue}
                icon={icon}
                color={isFilled ? '#e4d00a' : 'gray'}
            />
        );
    };

    return (
        <div>
            {Array.from({ length: maxStars }).map((_, index) => renderStar(index + 1))}
        </div>
    );
};

export default StarRating;
