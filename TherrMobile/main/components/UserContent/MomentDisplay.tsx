
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
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
import { getViewingMomentStyles } from '../../styles/user-content/moments';
import sanitizeNotificationMsg from '../../utilities/sanitizeNotificationMsg';

const { width: viewportWidth } = Dimensions.get('window');

interface IUserDetails {
    userName: string;
}

interface IMomentDisplayProps {
    translate: Function;
    date: string;
    expandMoment: Function;
    hashtags: any[];
    isDarkMode: boolean;
    isExpanded?: boolean;
    moment: any;
    momentMedia: string;
    userDetails: IUserDetails;
}

interface IMomentDisplayState {
}

export default class MomentDisplay extends React.Component<IMomentDisplayProps, IMomentDisplayState> {
    private viewMomentStyles;

    constructor(props: IMomentDisplayProps) {
        super(props);

        this.state = {
        };

        this.viewMomentStyles = getViewingMomentStyles({
            isDarkMode: props.isDarkMode,
        });
    }

    render() {
        const {
            date,
            expandMoment,
            hashtags,
            isDarkMode,
            isExpanded,
            moment,
            momentMedia,
            userDetails,
        } = this.props;

        return (
            <>
                <View style={this.viewMomentStyles.momentAuthorContainer}>
                    <Image
                        source={{ uri: `https://robohash.org/${moment.fromUserId}?size=52x52` }}
                        style={this.viewMomentStyles.momentUserAvatarImg}
                        containerStyle={this.viewMomentStyles.momentUserAvatarImgContainer}
                        PlaceholderContent={<ActivityIndicator size="large" color={therrTheme.colors.primary}/>}
                        transition={false}
                    />
                    <View style={this.viewMomentStyles.momentAuthorTextContainer}>
                        {
                            userDetails &&
                                <Text style={this.viewMomentStyles.momentUserName}>
                                    {`${userDetails.userName}`}
                                </Text>
                        }
                        <Text style={this.viewMomentStyles.dateTime}>
                            {date}
                        </Text>
                    </View>
                    {
                        !isExpanded &&
                        <Button
                            containerStyle={this.viewMomentStyles.moreButtonContainer}
                            buttonStyle={this.viewMomentStyles.moreButton}
                            icon={
                                <Icon
                                    name="more-horiz"
                                    size={24}
                                    color={isDarkMode ? therrTheme.colors.textWhite : therrTheme.colors.tertiary}
                                />
                            }
                            onPress={() => expandMoment(moment)}
                            type="clear"
                            TouchableComponent={TouchableWithoutFeedbackComponent}
                        />
                    }
                </View>
                <UserMedia
                    viewportWidth={viewportWidth}
                    media={momentMedia}
                    isVisible={momentMedia}
                />
                <View style={this.viewMomentStyles.momentContentTitleContainer}>
                    <Text
                        style={this.viewMomentStyles.momentContentTitle}
                        numberOfLines={2}
                    >
                        {sanitizeNotificationMsg(moment.notificationMsg)}
                    </Text>
                    <Button
                        containerStyle={this.viewMomentStyles.bookmarkButtonContainer}
                        buttonStyle={this.viewMomentStyles.bookmarkButton}
                        icon={
                            <Icon
                                name="bookmark-border"
                                size={24}
                                color={isDarkMode ? therrTheme.colors.textWhite : therrTheme.colors.tertiary}
                            />
                        }
                        onPress={() => expandMoment(moment)}
                        type="clear"
                        TouchableComponent={TouchableWithoutFeedbackComponent}
                    />
                </View>
                <Text style={this.viewMomentStyles.momentMessage} numberOfLines={3}>
                    <Autolink
                        text={moment.message}
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
