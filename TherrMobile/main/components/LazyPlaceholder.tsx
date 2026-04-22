import React from 'react';
import {
    Placeholder,
    PlaceholderMedia,
    PlaceholderLine,
    Fade,
    Shine,
} from 'rn-placeholder';

type LazyPlaceholderAnimation = 'fade' | 'shine-reverse';

interface LazyPlaceholderProps {
    animation?: LazyPlaceholderAnimation;
    lines?: Array<number | undefined>;
}

const ShineReverse = (props) => <Shine {...props} reverse />;

const ANIMATIONS = {
    'fade': Fade,
    'shine-reverse': ShineReverse,
};

const LazyPlaceholder = ({
    animation = 'shine-reverse',
    lines = [80, undefined],
}: LazyPlaceholderProps) => {
    const Animation = ANIMATIONS[animation];

    return (
        <Placeholder
            Animation={Animation}
            Left={PlaceholderMedia}
        >
            {lines.map((width, idx) => (
                <PlaceholderLine key={idx} width={width} />
            ))}
        </Placeholder>
    );
};

export default LazyPlaceholder;
