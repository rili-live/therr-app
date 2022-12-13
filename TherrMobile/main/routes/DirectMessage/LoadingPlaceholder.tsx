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
            <Placeholder
                Animation={Fade}
                Right={PlaceholderMedia}
            >
                <PlaceholderLine width={80} />
                <PlaceholderLine />
            </Placeholder>
        </>
    );
};

export default LoadingPlaceholder;
