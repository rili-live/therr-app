import React from 'react';
import {
    Placeholder,
    PlaceholderMedia,
    PlaceholderLine,
    Fade,
} from 'rn-placeholder';

const LoadingPlaceholder = () => {
    return (
        <>
            <Placeholder
                Animation={Fade}
                Left={PlaceholderMedia}
            >
                <PlaceholderLine width={80} />
                <PlaceholderLine />
            </Placeholder>
            <PlaceholderLine />
        </>
    );
};

export default LoadingPlaceholder;
