
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
import { ITherrThemeColors } from '../../styles/themes';
import TherrIcon from '../TherrIcon';
import numberToCurrencyStr from '../../utilities/numberToCurrencyStr';
import MissingImagePlaceholder from './MissingImagePlaceholder';

const { width: viewportWidth } = Dimensions.get('window');

interface IAreaDisplayCardProps {
    exchangeRate: number;
    translate: Function;
    cardWidth: number;
    cardHeight: number;
    isDarkMode: boolean;
    isFocused: boolean;
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
            cardHeight,
            exchangeRate,
            isFocused,
            onPress,
            theme,
            themeViewArea,
            translate,
        } = this.props;
        const shouldDisplayRewardsBanner = area.featuredIncentiveRewardValue
            && area.featuredIncentiveRewardKey
            && area.featuredIncentiveRewardKey === IncentiveRewardKeys.THERR_COIN_REWARD;
        const featuredStyle = shouldDisplayRewardsBanner
            ? themeViewArea.styles.cardFeatured
            : {};
        const rewardValue = shouldDisplayRewardsBanner
            && numberToCurrencyStr(Math.round((Number(area.featuredIncentiveRewardValue) * exchangeRate + Number.EPSILON) * 100) / 100);

        return (
            <View key={area.id} style={[themeViewArea.styles.cardContainer, {
                height: cardHeight,
                width: cardWidth,
            }]}>
                <Pressable onPress={() => onPress(area)} style={[
                    isFocused ? themeViewArea.styles.cardFocused : themeViewArea.styles.card,
                    featuredStyle,
                ]}>
                    <View style={[themeViewArea.styles.cardImageContainer]}>
                        {
                            areaMedia ?
                                // <UserMedia
                                //     onPress={() => onPress(area)}
                                //     viewportWidth={mediaWidth}
                                //     media={areaMedia}
                                //     isVisible={!!areaMedia}
                                //     isSingleView={false}
                                //     viewContainerStyles={{
                                //         flex: 1,
                                //     }}
                                //     onLayout={this.onUserMediaLayout}
                                // /> :
                                <Image
                                    source={{
                                        uri: areaMedia,
                                    }}
                                    style={[themeViewArea.styles.cardImage]}
                                    resizeMode="cover"
                                    PlaceholderContent={<ActivityIndicator />}
                                /> :
                                <MissingImagePlaceholder
                                    area={area}
                                    themeViewArea={themeViewArea}
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
                                            {translate('pages.viewSpace.buttons.coinRewardDollars', {
                                                amount: rewardValue,
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
