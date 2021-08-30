import React from 'react';
import { View } from 'react-native';
import userContentStyles from '../../styles/user-content';
import HashtagPill from './HashtagPill';

interface IHashtagsContainerProps {
    hasIcon?: boolean;
    hashtags: any[];
    onHashtagPress: Function;
    visibleCount?: number;
    right?: boolean;
}

export default ({ hasIcon = true, hashtags, onHashtagPress, visibleCount, right }: IHashtagsContainerProps) => {
    return (
        <View style={[userContentStyles.hashtagsContainer, { justifyContent: right ? 'flex-end' : 'flex-start' }]}>
            {
                hashtags.slice(0, visibleCount || hashtags.length).map((tag, i) => <HashtagPill tag={tag} hasIcon={hasIcon} key={i} onPress={onHashtagPress} />)
            }
        </View>
    );
};
