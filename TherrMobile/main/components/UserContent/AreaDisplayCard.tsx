
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    Text,
    View,
} from 'react-native';
import { Image } from 'react-native-elements';
import { IncentiveRewardKeys } from 'therr-js-utilities/constants';
import UserMedia from './UserMedia';
import { ITherrThemeColors } from '../../styles/themes';
import TherrIcon from '../TherrIcon';

const { width: viewportWidth } = Dimensions.get('window');
const placeholderMedia = require('../../assets/placeholder-content-media.png');

interface IAreaDisplayCardProps {
    translate: Function;
    date: string;
    cardWidth: number;
    isDarkMode: boolean;
    onPress: (area: any) => any;
    area: any;
    areaMedia?: any;
    theme: {
        styles: any;
        colors: ITherrThemeColors;
    };
    themeViewArea: {
        styles: any;
    };
}

interface IAreaDisplayCardState {
    mediaWidth: number;
}

export default class AreaDisplayCard extends React.PureComponent<IAreaDisplayCardProps, IAreaDisplayCardState> {
    constructor(props: IAreaDisplayCardProps) {
        super(props);

        this.state = {
            mediaWidth: viewportWidth / 2,
        };
    }

    onUserMediaLayout = (event) => {
        const { width } = event.nativeEvent.layout;
        this.setState({
            mediaWidth: width,
        });
    };

    render() {
        const {
            area,
            areaMedia,
            cardWidth,
            onPress,
            theme,
            themeViewArea,
            translate,
        } = this.props;
        const { mediaWidth } = this.state;

        const shouldDisplayRewardsBanner = area.featuredIncentiveRewardValue
            && area.featuredIncentiveRewardKey
            && area.featuredIncentiveRewardKey === IncentiveRewardKeys.THERR_COIN_REWARD;
        const featuredStyle = shouldDisplayRewardsBanner
            ? themeViewArea.styles.cardFeatured
            : {};

        return (
            <View key={area.id} style={[themeViewArea.styles.cardContainer, {
                width: cardWidth,
            }]}>
                <Pressable onPress={() => onPress(area)} style={[
                    themeViewArea.styles.card,
                    featuredStyle,
                ]}>
                    <View style={[themeViewArea.styles.cardImageContainer]}>
                        {
                            areaMedia ?
                                <UserMedia
                                    viewportWidth={mediaWidth}
                                    media={areaMedia}
                                    isVisible={!!areaMedia}
                                    isSingleView={false}
                                    viewContainerStyles={{
                                        flex: 1,
                                    }}
                                    onLayout={this.onUserMediaLayout}
                                /> :
                                <Image
                                    source={placeholderMedia}
                                    style={themeViewArea.styles.cardImage}
                                    resizeMode='cover'
                                    PlaceholderContent={<ActivityIndicator />}
                                />
                        }
                    </View>
                    <View style={themeViewArea.styles.textContent}>
                        <Text numberOfLines={2} style={themeViewArea.styles.cardTitle}>
                            {area.notificationMsg}
                        </Text>
                        {
                            shouldDisplayRewardsBanner ?
                                <View style={themeViewArea.styles.banner}>
                                    <View style={themeViewArea.styles.bannerTitle}>
                                        <TherrIcon
                                            name="hand-coin"
                                            size={20}
                                            color={theme.colors.accentYellow}
                                        />
                                        <Text numberOfLines={1} style={themeViewArea.styles.bannerTitleTextSmall}>
                                            {translate('pages.viewSpace.buttons.coinReward', {
                                                count: area.featuredIncentiveRewardValue,
                                            })}
                                        </Text>
                                    </View>
                                </View> :
                                <Text numberOfLines={2} style={themeViewArea.styles.cardDescription}>
                                    {area.message}
                                </Text>
                        }
                        {
                            area.distance != null &&
                            <Text  style={themeViewArea.styles.areaDistanceRight}>{`${area.distance}`}</Text>
                        }
                    </View>
                </Pressable>
            </View>
        );
    }
}
