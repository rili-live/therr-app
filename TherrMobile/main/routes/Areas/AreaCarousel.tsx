import React from 'react';
import { RefreshControl, View, Text, /* Platform, */ FlatList, Pressable } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
// import Carousel from 'react-native-snap-carousel';
import { buildStyles } from '../../styles/user-content/areas';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas/viewing';
import AreaDisplay from '../../components/UserContent/AreaDisplay';
import AreaDisplayMedium from '../../components/UserContent/AreaDisplayMedium';
import formatDate from '../../utilities/formatDate';
import ThoughtDisplay from '../../components/UserContent/ThoughtDisplay';

// let flatListRef;

const renderItem = ({ item: post }, {
    media,
    displaySize,
    inspectArea,
    toggleAreaOptions,
    fetchMedia,
    formattedDate,
    goToViewMap,
    goToViewUser,
    translate,
    theme,
    themeArea,
    themeForms,
    updateAreaReaction,
    user,
}) => {
    if (post.media && (!media || !media[post.media[0]?.id])) {
        fetchMedia(post.media[0]?.id);
    }
    const postMedia = media && media[post.media && post.media[0]?.id];
    const userDetails = post.fromUserName ? {
        userName: post.fromUserName,
    } : {
        userName: user.details.id === post.fromUserId ? user.details.userName : post.fromUserId,
    };

    if (!post.areaType) {
        return (
            <Pressable
                style={theme.styles.areaContainer}
                onPress={() => inspectArea(post)}
            >
                <ThoughtDisplay
                    translate={translate}
                    date={formattedDate}
                    goToViewUser={goToViewUser}
                    toggleThoughtOptions={toggleAreaOptions} // TODO
                    hashtags={post.hashTags ? post.hashTags.split(',') : []}
                    thought={post}
                    inspectThought={() => inspectArea(post)}
                    // TODO: Get username from response
                    user={user}
                    userDetails={userDetails}
                    updateThoughtReaction={updateAreaReaction}// TODO
                    isDarkMode={false}
                    theme={theme}
                    themeForms={themeForms}
                    themeViewArea={themeArea}
                />
            </Pressable>
        );
    }

    return (
        <Pressable
            style={theme.styles.areaContainer}
            onPress={() => inspectArea(post)}
        >
            {
                displaySize === 'medium' ?
                    <AreaDisplayMedium
                        translate={translate}
                        date={formattedDate}
                        goToViewMap={goToViewMap}
                        goToViewUser={goToViewUser}
                        toggleAreaOptions={toggleAreaOptions}
                        hashtags={post.hashTags ? post.hashTags.split(',') : []}
                        area={post}
                        inspectArea={() => inspectArea(post)}
                        // TODO: Get username from response
                        user={user}
                        userDetails={userDetails}
                        updateAreaReaction={updateAreaReaction}
                        areaMedia={postMedia}
                        isDarkMode={false}
                        theme={theme}
                        themeForms={themeForms}
                        themeViewArea={themeArea}
                    /> :
                    <AreaDisplay
                        translate={translate}
                        date={formattedDate}
                        goToViewMap={goToViewMap}
                        goToViewUser={goToViewUser}
                        toggleAreaOptions={toggleAreaOptions}
                        hashtags={post.hashTags ? post.hashTags.split(',') : []}
                        area={post}
                        inspectArea={() => inspectArea(post)}
                        // TODO: Get username from response
                        user={user}
                        userDetails={userDetails}
                        updateAreaReaction={updateAreaReaction}
                        areaMedia={postMedia}
                        isDarkMode={false}
                        theme={theme}
                        themeForms={themeForms}
                        themeViewArea={themeArea}
                    />
            }
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
    displaySize,
    inspectArea,
    containerRef,
    fetchMedia,
    goToViewMap,
    goToViewUser,
    handleRefresh,
    isLoading,
    onEndReached,
    toggleAreaOptions,
    translate,
    updateMomentReaction,
    updateSpaceReaction,
    emptyListMessage,
    renderHeader,
    renderLoader,
    rootStyles,
    user,
    // viewportHeight,
    // viewportWidth,
}) => {
    const [refreshing, setRefreshing] = React.useState(false);

    // TODO: Move to top level
    const theme = buildStyles(user.details.mobileThemeName);
    const themeArea = buildAreaStyles(user.details.mobileThemeName, false);
    const themeForms = buildFormStyles(user.details.mobileThemeName);
    const isUsingBottomSheet = (displaySize === 'small' || displaySize === 'medium');
    const FlatListComponent = isUsingBottomSheet ? BottomSheetFlatList : FlatList;

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

    if (isLoading) {
        return renderLoader();
    }

    return (
        <>
            <FlatListComponent
                data={activeData}
                keyExtractor={(item) => String(item.id)}
                renderItem={(itemObj) => renderItem(itemObj, {
                    media: content?.media,
                    displaySize: displaySize || 'large', // default to large
                    inspectArea,
                    fetchMedia,
                    formattedDate: formatDate(itemObj.item.createdAt),
                    goToViewMap,
                    goToViewUser,
                    toggleAreaOptions,
                    translate,
                    theme,
                    themeArea,
                    themeForms,
                    updateAreaReaction: itemObj.item.areaType === 'spaces' ? updateSpaceReaction : updateMomentReaction,
                    user,
                })}
                initialNumToRender={1}
                ListEmptyComponent={<Text style={theme.styles.noAreasFoundText}>{emptyListMessage}</Text>}
                ListHeaderComponent={renderHeader()}
                ListFooterComponent={<View style={theme.styles.areaCarouselFooter} />}
                ref={(component) => {
                    containerRef && containerRef(component);
                    return component;
                }}
                // refreshControl is not yet supported by BottomSheet
                refreshControl={<RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />}
                refreshing={isUsingBottomSheet ? refreshing : undefined}
                onRefresh={isUsingBottomSheet ? onRefresh : undefined}
                style={[rootStyles.stretch, theme.styles.areaCarousel]}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                // onContentSizeChange={() => content.activeMoments?.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
            />
        </>
    );
};
