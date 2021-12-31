import React from 'react';
import { RefreshControl, View, Text, /* Platform, */ FlatList, Pressable } from 'react-native';
// import Carousel from 'react-native-snap-carousel';
import styles from '../../styles';
import momentStyles from '../../styles/user-content/moments';
import AreaDisplay from '../../components/UserContent/AreaDisplay';
import formatDate from '../../utilities/formatDate';
import { CarouselTabsMenu } from './CarouselTabsMenu';

// let flatListRef;

const renderItem = ({ item: area }, {
    content,
    inspectArea,
    toggleAreaOptions,
    formattedDate,
    goToViewUser,
    translate,
    updateAreaReaction,
}) => {
    const areaMedia = content?.media[area.media && area.media[0]?.id];

    return (
        <Pressable
            style={momentStyles.areaContainer}
            onPress={() => inspectArea(area)}
        >
            <AreaDisplay
                translate={translate}
                date={formattedDate}
                goToViewUser={goToViewUser}
                toggleAreaOptions={toggleAreaOptions}
                hashtags={area.hashTags ? area.hashTags.split(",") : []}
                area={area}
                // TODO: Get username from response
                userDetails={{
                    userName: area.fromUserName || area.fromUserId,
                }}
                updateAreaReaction={updateAreaReaction}
                areaMedia={areaMedia}
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
    activeData,
    activeTab,
    content,
    inspectArea,
    containerRef,
    goToViewUser,
    handleRefresh,
    onEndReached,
    onTabSelect,
    shouldShowTabs,
    toggleAreaOptions,
    translate,
    updateMomentReaction,
    updateSpaceReaction,
    emptyListMessage,
    user,
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
    //                 style={[styles.scrollViewFull, momentStyles.areaCarousel]}
    //                 vertical={true}
    //                 data={content.activeMoments}
    //                 renderItem={(itemObj) => renderItem(itemObj, {
    //                     content,
    //                     inspectArea,
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
                data={activeData}
                keyExtractor={(item) => String(item.id)}
                renderItem={(itemObj) => renderItem(itemObj, {
                    content,
                    inspectArea,
                    formattedDate: formatDate(itemObj.item.createdAt),
                    goToViewUser,
                    toggleAreaOptions,
                    translate,
                    updateAreaReaction: itemObj.item.areaType === 'spaces' ? updateSpaceReaction : updateMomentReaction,
                })}
                ListEmptyComponent={<Text style={momentStyles.noAreasFoundText}>{emptyListMessage}</Text>}
                ListHeaderComponent={
                    shouldShowTabs ? <CarouselTabsMenu
                        activeTab={activeTab}
                        onButtonPress={onTabSelect}
                        translate={translate}
                        user={user}
                    /> : null
                }
                ListFooterComponent={<View style={momentStyles.areaCarouselFooter} />}
                ref={(component) => {
                    containerRef && containerRef(component);
                    return component;
                }}
                refreshControl={<RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />}
                style={[styles.stretch, momentStyles.areaCarousel]}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                // onContentSizeChange={() => content.activeMoments?.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
            />
        </>
    );
};
