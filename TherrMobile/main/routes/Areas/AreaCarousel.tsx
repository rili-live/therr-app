import React from 'react';
import { RefreshControl, View, /* Platform, */ FlatList, Pressable, Dimensions } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
    Content,
} from 'therr-js-utilities/constants';
// import Carousel from 'react-native-snap-carousel';
import { buildStyles as buildRootStyles } from '../../styles';
import { buildStyles } from '../../styles/user-content/areas';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas/viewing';
import { buildStyles as buildThoughtStyles } from '../../styles/user-content/thoughts/viewing';
import AreaDisplay from '../../components/UserContent/AreaDisplay';
import AreaDisplayMedium from '../../components/UserContent/AreaDisplayMedium';
import ThoughtDisplay from '../../components/UserContent/ThoughtDisplay';
import ListEmpty from '../../components/ListEmpty';
import { getUserContentUri } from '../../utilities/content';

const { width: screenWidth } = Dimensions.get('window');

interface IAreaCarouselProps {
    activeData: any;
    content: any;
    displaySize?: any;
    emptyIconName?: string;
    inspectContent: any;
    containerRef: any;
    fetchMedia: any;
    goToViewMap: any;
    goToViewUser: any;
    handleRefresh: any;
    isLoading: any;
    onEndReached: any;
    toggleAreaOptions: any;
    toggleThoughtOptions?: any;
    translate: any;
    updateEventReaction: any;
    updateMomentReaction: any;
    updateSpaceReaction: any;
    updateThoughtReaction?: any;
    emptyListMessage: any;
    renderHeader: any;
    renderFooter?: any;
    renderLoader: any;
    rootStyles: any;
    user: any;
}

// let flatListRef;

const renderItem = ({ item: post }, {
    media,
    displaySize,
    inspectContent,
    toggleContentOptions,
    fetchMedia,
    goToViewMap,
    goToViewUser,
    translate,
    theme,
    themeViewPost,
    themeForms,
    updateReaction,
    user,
}) => {
    const mediaPath = (post.media && post.media[0]?.path);
    const mediaType = (post.media && post.media[0]?.type);

    if (post.media && (!media || !media[post.media[0]?.id])
        && (!mediaPath || mediaType !== Content.mediaTypes.USER_IMAGE_PUBLIC)) {
        // Only fetch when we need signed urls
        fetchMedia(post.media[0]?.id);
    }

    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
    const postMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri(post.media[0], screenWidth, screenWidth)
        : media && media[post.media && post.media[0]?.id];
    const isMe = user.details.id === post.fromUserId;
    let userDetails: any = {
        userName: post.fromUserName || (user.details.id === post.fromUserId ? user.details.userName : translate('alertTitles.nameUnknown')),
    };

    if (isMe) {
        userDetails = {
            ...user.details,
            ...userDetails,
        };
    }


    if (!post.areaType) {
        return (
            <Pressable
                key={post.id}
                style={theme.styles.areaContainer}
                onPress={() => inspectContent(post)}
            >
                <ThoughtDisplay
                    translate={translate}
                    goToViewUser={goToViewUser}
                    toggleThoughtOptions={toggleContentOptions}
                    hashtags={post.hashTags ? post.hashTags.split(',') : []}
                    thought={post}
                    inspectThought={inspectContent} // TODO
                    // TODO: Get username from response
                    user={user}
                    contentUserDetails={userDetails}
                    updateThoughtReaction={updateReaction}
                    isDarkMode={false}
                    isRepliable
                    theme={theme}
                    themeForms={themeForms}
                    themeViewContent={themeViewPost}
                />
            </Pressable>
        );
    }

    return (
        <Pressable
            key={post.id}
            style={theme.styles.areaContainer}
            onPress={() => inspectContent(post)}
        >
            {
                displaySize === 'medium' ?
                    <AreaDisplayMedium
                        translate={translate}
                        goToViewMap={goToViewMap}
                        goToViewUser={goToViewUser}
                        toggleAreaOptions={toggleContentOptions}
                        hashtags={post.hashTags ? post.hashTags.split(',') : []}
                        area={post}
                        inspectContent={() => inspectContent(post)}
                        // TODO: Get username from response
                        user={user}
                        areaUserDetails={userDetails}
                        updateAreaReaction={updateReaction}
                        areaMedia={postMedia}
                        isDarkMode={false}
                        theme={theme}
                        themeForms={themeForms}
                        themeViewArea={themeViewPost}
                    /> :
                    <AreaDisplay
                        translate={translate}
                        goToViewMap={goToViewMap}
                        goToViewUser={goToViewUser}
                        toggleAreaOptions={toggleContentOptions}
                        hashtags={post.hashTags ? post.hashTags.split(',') : []}
                        area={post}
                        inspectContent={() => inspectContent(post)}
                        // TODO: Get username from response
                        user={user}
                        areaUserDetails={userDetails}
                        updateAreaReaction={updateReaction}
                        areaMedia={postMedia}
                        isDarkMode={false}
                        placeholderMediaType={post.areaType === 'spaces' ? 'static' : undefined}
                        theme={theme}
                        themeForms={themeForms}
                        themeViewArea={themeViewPost}
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

const AreaCarousel = ({
    activeData,
    content,
    displaySize,
    emptyIconName,
    inspectContent,
    containerRef,
    fetchMedia,
    goToViewMap,
    goToViewUser,
    handleRefresh,
    isLoading,
    onEndReached,
    toggleAreaOptions,
    toggleThoughtOptions,
    translate,
    updateEventReaction,
    updateMomentReaction,
    updateSpaceReaction,
    updateThoughtReaction,
    emptyListMessage,
    renderHeader,
    renderFooter,
    renderLoader,
    rootStyles,
    user,
    // viewportHeight,
    // viewportWidth,
}: IAreaCarouselProps) => {
    const [refreshing, setRefreshing] = React.useState(false);

    // TODO: Move to top level
    const themeRoot = buildRootStyles(user.details.mobileThemeName);
    const theme = buildStyles(user.details.mobileThemeName);
    const themeArea = buildAreaStyles(user.details.mobileThemeName, false);
    const themeThought = buildThoughtStyles(user.details.mobileThemeName, false);
    const themeForms = buildFormStyles(user.details.mobileThemeName);
    const isUsingBottomSheet = (displaySize === 'small' || displaySize === 'medium');
    const FlatListComponent = isUsingBottomSheet ? BottomSheetFlatList : FlatList;

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        handleRefresh()?.finally(() => setRefreshing(false));
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
    //                     inspectContent,
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
                renderItem={(itemObj) => {
                    let updateReaction = (!itemObj.item.areaType && !!updateThoughtReaction)
                        ? updateThoughtReaction
                        : (itemObj.item.areaType === 'spaces' ? updateSpaceReaction : updateMomentReaction);
                    if (itemObj.item.areaType === 'events') {
                        updateReaction = updateEventReaction;
                    }
                    const toggleContentOptions = (!itemObj.item.areaType && !!toggleThoughtOptions)
                        ? toggleThoughtOptions
                        : toggleAreaOptions;
                    return renderItem(itemObj, {
                        media: content?.media,
                        displaySize: displaySize || 'large', // default to large
                        inspectContent,
                        fetchMedia,
                        goToViewMap,
                        goToViewUser,
                        toggleContentOptions,
                        translate,
                        theme,
                        themeViewPost: itemObj.item.areaType ? themeArea : themeThought,
                        themeForms,
                        updateReaction,
                        user,
                    });
                }}
                initialNumToRender={1}
                ListEmptyComponent={<ListEmpty iconName={emptyIconName} text={emptyListMessage} theme={themeRoot} />}
                ListHeaderComponent={renderHeader()}
                ListFooterComponent={
                    renderFooter
                        ? renderFooter()
                        : <View style={theme.styles.areaCarouselFooter} />
                }
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

AreaCarousel.whyDidYouRender = true;

export default AreaCarousel;
