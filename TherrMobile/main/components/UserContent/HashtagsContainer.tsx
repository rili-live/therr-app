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

export default ({ hasIcon = true, hashtags, onHashtagPress, visibleCount, right, styles }: IHashtagsContainerProps) => {
    return (
        <View style={[userContentStyles.hashtagsContainer, { justifyContent: right ? 'flex-end' : 'flex-start' }]}>
            {
                hashtags.slice(0, visibleCount || hashtags.length).map((tag, i) => (
                    <HashtagPill tag={tag} hasIcon={hasIcon} key={i} onPress={onHashtagPress} styles={styles} />
                )
                )
            }
        </View>
    );
};
