import React from 'react';
import {
    Placeholder,
    PlaceholderLine,
    Fade,
} from 'rn-placeholder';

const LoadingPlaceholderInterests = () => {
    return (
        <>
            <Placeholder
                Animation={Fade}
            >
                <PlaceholderLine />
                <PlaceholderLine />
            </Placeholder>
        </>
    );
};

export default LoadingPlaceholderInterests;
