import React from 'react';
import {
    Placeholder,
    PlaceholderMedia,
    PlaceholderLine,
    Fade,
} from 'rn-placeholder';

const LazyPlaceholder = () => {
    return (
        <Placeholder
            Animation={Fade}
            Left={PlaceholderMedia}
        >
            <PlaceholderLine width={80} />
            <PlaceholderLine />
            <PlaceholderLine />
            <PlaceholderLine width={30} />
        </Placeholder>
    );
};

export default LazyPlaceholder;
