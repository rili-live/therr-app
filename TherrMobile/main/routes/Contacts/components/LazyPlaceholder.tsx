import React from 'react';
import {
    Placeholder,
    PlaceholderMedia,
    PlaceholderLine,
    Shine,
} from 'rn-placeholder';

const LazyPlaceholder = () => {
    return (
        <Placeholder
            Animation={props => <Shine {...props} reverse />}
            Left={PlaceholderMedia}
        >
            <PlaceholderLine width={80} />
            <PlaceholderLine />
        </Placeholder>
    );
};

export default LazyPlaceholder;
