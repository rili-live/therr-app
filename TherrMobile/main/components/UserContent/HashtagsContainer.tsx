import React from 'react';
import { View } from 'react-native';
import userContentStyles from '../../styles/user-content';
import HashtagPill from './HashtagPill';

export default ({ hashtags, onHashtagPress }) => {
    return (
        <View style={userContentStyles.hashtagsContainer}>
            {
                hashtags.map((tag, i) => <HashtagPill tag={tag} key={i} onPress={onHashtagPress} />)
            }
        </View>
    );
};
