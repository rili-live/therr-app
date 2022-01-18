import React from 'react';
import { RefreshControl, View, Text, /* Platform, */ FlatList, Pressable } from 'react-native';
// import Carousel from 'react-native-snap-carousel';
import { buildStyles } from '../../styles/user-content/moments';
import AreaDisplay from '../../components/UserContent/AreaDisplay';
import formatDate from '../../utilities/formatDate';

// let flatListRef;

const renderItem = ({ item: area }, {
    content,
    inspectArea,
    toggleAreaOptions,
    formattedDate,
    goToViewUser,
    translate,
    theme,
    updateAreaReaction,
}) => {
    const areaMedia = content?.media[area.media && area.media[0]?.id];

    return (
        <Pressable
            style={theme.styles.areaContainer}
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
                user={user}
                userDetails={{
                    userName: area.fromUserName || area.fromUserId,
                }}
                updateAreaReaction={updateAreaReaction}
                areaMedia={areaMedia}
                isDarkMode={false}
                theme={theme}
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
    content,
    inspectArea,
    containerRef,
    goToViewUser,
    handleRefresh,
    onEndReached,
    toggleAreaOptions,
    translate,
    updateMomentReaction,
    updateSpaceReaction,
    emptyListMessage,
    renderHeader,
    rootStyles,
    user,
    // viewportHeight,
    // viewportWidth,
}) => {
    const [refreshing, setRefreshing] = React.useState(false);
    const theme = buildStyles(user.details.mobileThemeName);

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
                    theme,
                    updateAreaReaction: itemObj.item.areaType === 'spaces' ? updateSpaceReaction : updateMomentReaction,
                })}
                ListEmptyComponent={<Text style={theme.styles.noAreasFoundText}>{emptyListMessage}</Text>}
                ListHeaderComponent={renderHeader()}
                ListFooterComponent={<View style={theme.styles.areaCarouselFooter} />}
                ref={(component) => {
                    containerRef && containerRef(component);
                    return component;
                }}
                refreshControl={<RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />}
                style={[rootStyles.stretch, theme.styles.areaCarousel]}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                // onContentSizeChange={() => content.activeMoments?.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
            />
        </>
    );
};
