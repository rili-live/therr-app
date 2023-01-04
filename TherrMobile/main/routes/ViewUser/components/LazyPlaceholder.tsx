import React from 'react';
import {
    Placeholder,
    PlaceholderMedia,
    PlaceholderLine,
    Shine,
} from 'rn-placeholder';

const ShineComponent = props => <Shine {...props} reverse />;

const LazyPlaceholder = () => {
    return (
        <Placeholder
            Animation={ShineComponent}
            Left={PlaceholderMedia}
        >
            <PlaceholderLine />
            <PlaceholderLine />
        </Placeholder>
    );
};

export default LazyPlaceholder;
