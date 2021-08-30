import React from 'react';
import { RefreshControl, View, /* Platform, */ FlatList, Pressable } from 'react-native';
// import Carousel from 'react-native-snap-carousel';
import styles from '../../styles';
import momentStyles from '../../styles/user-content/moments';
import MomentDisplay from '../../components/UserContent/MomentDisplay';
import formatDate from '../../utilities/formatDate';

// let flatListRef;

const renderItem = ({ item: moment }, {
    content,
    expandMoment,
    formattedDate,
    translate,
}) => {
    const momentMedia = content?.media[moment.media && moment.media[0]?.id];

    return (
        <Pressable
            style={momentStyles.momentContainer}
            onPress={() => expandMoment(moment)}
        >
            <MomentDisplay
                translate={translate}
                date={formattedDate}
                expandMoment={expandMoment}
                hashtags={moment.hashTags ? moment.hashTags.split(",") : []}
                moment={moment}
                // TODO: Get username from response
                userDetails={{
                    userName: moment.fromUserName || moment.fromUserId,
                }}
                momentMedia={momentMedia}
                isDarkMode={false}
            />
        </Pressable>
    );
};

// const Divider = () => {
//     return (
//         <View style={momentStyles.divider}></View>
//     );
// };

export default ({
    content,
    expandMoment,
    containerRef,
    handleRefresh,
    translate,
    // viewportHeight,
    // viewportWidth,
}) => {
    const [refreshing, setRefreshing] = React.useState(false);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        handleRefresh().finally(() => setRefreshing(false));
    }, [handleRefresh]);

    // if (Platform.OS === 'ios') {
    //     return (
    //         <>
    //             <Carousel
    //                 contentInsetAdjustmentBehavior="automatic"
    //                 style={[styles.scrollViewFull, momentStyles.momentCarousel]}
    //                 vertical={true}
    //                 data={content.activeMoments}
    //                 renderItem={(itemObj) => renderItem(itemObj, {
    //                     content,
    //                     expandMoment,
    //                     formattedDate: formatDate(itemObj.item.createdAt),
    //                     translate,
    //                 })}
    //                 sliderWidth={viewportWidth}
    //                 sliderHeight={viewportHeight}
    //                 itemWidth={viewportWidth}
    //                 itemHeight={viewportHeight}
    //                 slideStyle={{ width: viewportWidth }}
    //                 inactiveSlideOpacity={1}
    //                 inactiveSlideScale={1}
    //                 windowSize={21}
    //             />
    //         </>
    //     );
    // }

    return (
        <>
            <FlatList
                data={content.activeMoments}
                keyExtractor={(item) => String(item.id)}
                renderItem={(itemObj) => renderItem(itemObj, {
                    content,
                    expandMoment,
                    formattedDate: formatDate(itemObj.item.createdAt),
                    translate,
                })}
                ListHeaderComponent={<View  style={momentStyles.momentCarouselHeader} />}
                ListFooterComponent={<View  style={momentStyles.momentCarouselFooter} />}
                ref={(component) => {
                    containerRef && containerRef(component);
                    return component;
                }}
                refreshControl={<RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />}
                style={[styles.stretch, momentStyles.momentCarousel]}
                // onContentSizeChange={() => content.activeMoments?.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
            />
        </>
    );
};
