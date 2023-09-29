
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    Text,
    View,
} from 'react-native';
import { Image } from 'react-native-elements';
import LottieView from 'lottie-react-native';
import { IncentiveRewardKeys } from 'therr-js-utilities/constants';
import { ITherrThemeColors } from '../../styles/themes';
import TherrIcon from '../TherrIcon';
import missingImageDeals from '../../assets/missing-image-deals.json';
import missingImageFood from '../../assets/missing-image-food.json';
import missingImageStorefront from '../../assets/missing-image-storefront.json';
import missingImageIdea from '../../assets/missing-image-idea.json';
import missingImageMusic from '../../assets/missing-image-music.json';
import missingImageNature from '../../assets/missing-image-nature.json';

const { width: viewportWidth } = Dimensions.get('window');
const placeholderMedia = require('../../assets/placeholder-content-media.png');

interface IAreaDisplayCardProps {
    translate: Function;
    date: string;
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

    renderMissingImage = () => {
        const { area, themeViewArea } = this.props;

        if (area?.category) {
            let missingImage: any = missingImageFood;
            if (area?.category === 'food' || area?.category === 'menu') {
                missingImage = missingImageFood;
            }
            if (area?.category === 'deals') {
                missingImage = missingImageDeals;
            }
            if (area?.category === 'storefront') {
                missingImage = missingImageStorefront;
            }
            if (area?.category === 'idea') {
                missingImage = missingImageIdea;
            }
            if (area?.category === 'music') {
                missingImage = missingImageMusic;
            }
            if (area?.category === 'nature') {
                missingImage = missingImageNature;
            }
            return (
                <View style={themeViewArea.styles.cardImage}>
                    <LottieView
                        source={missingImage}
                        resizeMode="contain"
                        speed={1}
                        autoPlay
                        loop={false}
                        style={[{position: 'absolute', width: '100%', height: '100%'}]}
                    />
                </View>
            );
        }

        return (
            <Image
                source={placeholderMedia}
                style={themeViewArea.styles.cardImage}
                resizeMode='cover'
                PlaceholderContent={<ActivityIndicator />}
            />
        );
    };

    render() {
        const {
            area,
            areaMedia,
            cardWidth,
            cardHeight,
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
                                    resizeMode='cover'
                                    PlaceholderContent={<ActivityIndicator />}
                                /> :
                                this.renderMissingImage()
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
