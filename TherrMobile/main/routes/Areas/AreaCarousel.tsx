import React from 'react';
import { RefreshControl, View, /* Platform, */ FlatList, Pressable, Dimensions } from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
    Content,
} from 'therr-js-utilities/constants';
import { buildStyles as buildRootStyles } from '../../styles';
import { buildStyles } from '../../styles/user-content/areas';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildAreaStyles } from '../../styles/user-content/areas/viewing';
import { buildStyles as buildThoughtStyles } from '../../styles/user-content/thoughts/viewing';
import { isDarkTheme } from '../../styles/themes';
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
    fetchMedia?: any;
    goToViewMap: any;
    goToViewUser: any;
    handleRefresh: any;
    isLoading: any;
    onEndReached?: any;
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
    goToViewMap,
    goToViewUser,
    translate,
    theme,
    themeViewPost,
    themeForms,
    updateReaction,
    user,
    isDarkMode,
}) => {
    const mediaPath = post.medias?.[0]?.path;
    const mediaType = post.medias?.[0]?.type;

    // Use the cacheable api-gateway media endpoint when image is public otherwise fallback to signed url
    let postMedia = mediaPath && mediaType === Content.mediaTypes.USER_IMAGE_PUBLIC
        ? getUserContentUri((post.medias?.[0]), screenWidth, screenWidth)
        : media?.[mediaPath];
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
                    isDarkMode={isDarkMode}
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
                        isDarkMode={isDarkMode}
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
                        isDarkMode={isDarkMode}
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
    const mobileThemeName = user.settings?.mobileThemeName;

    const { themeRoot, theme, themeArea, themeThought, themeForms, isDarkMode } = React.useMemo(() => {
        const dark = isDarkTheme(mobileThemeName);
        return {
            themeRoot: buildRootStyles(mobileThemeName),
            theme: buildStyles(mobileThemeName),
            themeArea: buildAreaStyles(mobileThemeName, dark),
            themeThought: buildThoughtStyles(mobileThemeName, dark),
            themeForms: buildFormStyles(mobileThemeName),
            isDarkMode: dark,
        };
    }, [mobileThemeName]);

    const isUsingBottomSheet = (displaySize === 'small' || displaySize === 'medium');
    const FlatListComponent = isUsingBottomSheet ? BottomSheetFlatList : FlatList;

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        handleRefresh()?.finally(() => setRefreshing(false));
    }, [handleRefresh]);

    const media = content?.media;

    const flatRenderItem = React.useCallback((itemObj) => {
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
            media,
            displaySize: displaySize || 'large', // default to large
            inspectContent,
            goToViewMap,
            goToViewUser,
            toggleContentOptions,
            translate,
            theme,
            themeViewPost: itemObj.item.areaType ? themeArea : themeThought,
            themeForms,
            updateReaction,
            user,
            isDarkMode,
        });
    }, [
        media, displaySize, inspectContent, goToViewMap, goToViewUser,
        toggleAreaOptions, toggleThoughtOptions, translate,
        theme, themeArea, themeThought, themeForms,
        updateEventReaction, updateMomentReaction, updateSpaceReaction, updateThoughtReaction,
        user, isDarkMode,
    ]);

    const listEmptyComponent = React.useMemo(
        () => <ListEmpty iconName={emptyIconName} text={emptyListMessage} theme={themeRoot} />,
        [emptyIconName, emptyListMessage, themeRoot]
    );

    const listHeaderComponent = React.useMemo(
        () => renderHeader(),
        // renderHeader closes over activeData in the parent; re-run when data changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [renderHeader, activeData]
    );

    const listFooterComponent = React.useMemo(
        () => (renderFooter
            ? renderFooter({ content: activeData })
            : <View style={theme.styles.areaCarouselFooter} />),
        [renderFooter, activeData, theme]
    );

    const refreshControl = React.useMemo(
        () => <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />,
        [refreshing, onRefresh]
    );

    const listStyle = React.useMemo(
        () => [rootStyles.stretch, theme.styles.areaCarousel],
        [rootStyles, theme]
    );

    const keyExtractor = React.useCallback((item) => String(item.id), []);

    const setListRef = React.useCallback((component) => {
        containerRef && containerRef(component);
        return component;
    }, [containerRef]);

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
                keyExtractor={keyExtractor}
                renderItem={flatRenderItem}
                initialNumToRender={1}
                ListEmptyComponent={listEmptyComponent}
                ListHeaderComponent={listHeaderComponent}
                ListFooterComponent={listFooterComponent}
                ref={setListRef}
                // refreshControl is not yet supported by BottomSheet
                refreshControl={refreshControl}
                refreshing={isUsingBottomSheet ? refreshing : undefined}
                onRefresh={isUsingBottomSheet ? onRefresh : undefined}
                style={listStyle}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.65}
                // onContentSizeChange={() => content.activeMoments?.length && flatListRef.scrollToOffset({ animated: true, offset: 0 })}
            />
        </>
    );
};

AreaCarousel.whyDidYouRender = true;

export default AreaCarousel;
