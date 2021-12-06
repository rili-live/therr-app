
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    Text,
    TouchableWithoutFeedbackComponent,
    View,
} from 'react-native';
import { Button, Image } from 'react-native-elements';
import Autolink from 'react-native-autolink';
import Icon from 'react-native-vector-icons/MaterialIcons';
import UserMedia from './UserMedia';
import HashtagsContainer from './HashtagsContainer';
import styles from '../../styles';
import * as therrTheme from '../../styles/themes';
import { getViewingMomentStyles as getViewingAreaStyles } from '../../styles/user-content/moments';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';

const { width: viewportWidth } = Dimensions.get('window');

interface IUserDetails {
    userName: string;
}

interface IAreaDisplayProps {
    translate: Function;
    date: string;
    toggleAreaOptions: Function;
    hashtags: any[];
    isDarkMode: boolean;
    isExpanded?: boolean;
    area: any;
    areaMedia: string;
    goToViewUser: Function;
    updateAreaReaction: Function;
    userDetails: IUserDetails;
}

interface IAreaDisplayState {
}

export default class AreaDisplay extends React.Component<IAreaDisplayProps, IAreaDisplayState> {
    private viewAreaStyles;

    constructor(props: IAreaDisplayProps) {
        super(props);

        this.state = {
        };

        this.viewAreaStyles = getViewingAreaStyles({
            isDarkMode: props.isDarkMode,
        });
    }

    onBookmarkPress = (area) => {
        const { updateAreaReaction } = this.props;

        updateAreaReaction(area.id, {
            userBookmarkCategory: !!area.reaction?.userBookmarkCategory ? null : 'Uncategorized',
        });
    }

    render() {
        const {
            date,
            toggleAreaOptions,
            hashtags,
            isDarkMode,
            isExpanded,
            area,
            areaMedia,
            goToViewUser,
            userDetails,
        } = this.props;

        const isBookmarked = area.reaction?.userBookmarkCategory;

        return (
            <>
                <View style={this.viewAreaStyles.areaAuthorContainer}>
                    <Pressable
                        onPress={() => goToViewUser(area.fromUserId)}
                    >
                        <Image
                            source={{ uri: `https://robohash.org/${area.fromUserId}?size=52x52` }}
                            style={this.viewAreaStyles.areaUserAvatarImg}
                            containerStyle={this.viewAreaStyles.areaUserAvatarImgContainer}
                            PlaceholderContent={<ActivityIndicator size="large" color={therrTheme.colors.primary}/>}
                            transition={false}
                        />
                    </Pressable>
                    <View style={this.viewAreaStyles.areaAuthorTextContainer}>
                        {
                            userDetails &&
                                <Text style={this.viewAreaStyles.areaUserName}>
                                    {`${userDetails.userName}`}
                                </Text>
                        }
                        <Text style={this.viewAreaStyles.dateTime}>
                            {date}
                        </Text>
                    </View>
                    <Button
                        containerStyle={this.viewAreaStyles.moreButtonContainer}
                        buttonStyle={this.viewAreaStyles.moreButton}
                        icon={
                            <Icon
                                name="more-horiz"
                                size={24}
                                color={isDarkMode ? therrTheme.colors.textWhite : therrTheme.colors.tertiary}
                            />
                        }
                        onPress={() => toggleAreaOptions(area)}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <UserMedia
                    viewportWidth={viewportWidth}
                    media={areaMedia}
                    isVisible={areaMedia}
                />
                <View style={this.viewAreaStyles.areaContentTitleContainer}>
                    <Text
                        style={this.viewAreaStyles.areaContentTitle}
                        numberOfLines={2}
                    >
                        {sanitizeNotificationMsg(area.notificationMsg)}
                    </Text>
                    <Button
                        containerStyle={this.viewAreaStyles.bookmarkButtonContainer}
                        buttonStyle={this.viewAreaStyles.bookmarkButton}
                        icon={
                            <Icon
                                name={ isBookmarked ? 'bookmark' : 'bookmark-border' }
                                size={24}
                                color={isDarkMode ? therrTheme.colors.textWhite : therrTheme.colors.tertiary}
                            />
                        }
                        onPress={() => this.onBookmarkPress(area)}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <Text style={this.viewAreaStyles.areaMessage} numberOfLines={3}>
                    <Autolink
                        text={area.message}
                        linkStyle={styles.link}
                        phone="sms"
                    />
                </Text>
                <View>
                    <HashtagsContainer
                        hasIcon={false}
                        hashtags={hashtags}
                        onHashtagPress={() => {}}
                        visibleCount={isExpanded ? 20 : 5}
                        right
                    />
                </View>
            </>
        );
    }
}
