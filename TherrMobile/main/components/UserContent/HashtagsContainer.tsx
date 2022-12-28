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
    styles: {
        buttonPill: any;
        buttonPillIcon: any;
        buttonPillContainer: any;
        buttonPillTitle: any;
    };
}

export default React.memo(({ hasIcon = true, hashtags, onHashtagPress, visibleCount, right, styles }: IHashtagsContainerProps) => {
    const visibleHashtags = hashtags.slice(0, visibleCount || hashtags.length);

    if (!visibleHashtags.length) {
        return null;
    }

    return (
        <View style={[userContentStyles.hashtagsContainer, { justifyContent: right ? 'flex-end' : 'flex-start' }]}>
            {
                visibleHashtags.map((tag, i) => (
                    <HashtagPill tag={tag} hasIcon={hasIcon} key={i} onPress={onHashtagPress} styles={styles} />
                )
                )
            }
        </View>
    );
});
