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
            <PlaceholderLine width={80} />
            <PlaceholderLine />
        </Placeholder>
    );
};

export default LazyPlaceholder;
