import React from 'react';
import { View } from 'react-native';
import userContentStyles from '../../styles/user-content';
import HashtagPill from './HashtagPill';

export default ({ hasIcon = true, hashtags, onHashtagPress }) => {
    return (
        <View style={userContentStyles.hashtagsContainer}>
            {
                hashtags.map((tag, i) => <HashtagPill tag={tag} hasIcon={hasIcon} key={i} onPress={onHashtagPress} />)
            }
        </View>
    );
};
