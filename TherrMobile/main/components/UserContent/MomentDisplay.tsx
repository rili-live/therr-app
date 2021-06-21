
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Text,
    View,
} from 'react-native';
import { Image } from 'react-native-elements';
import Autolink from 'react-native-autolink';
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
            hashtags,
            isExpanded,
            moment,
            momentMedia,
            userDetails,
        } = this.props;

        return (
            <>
                <View style={this.viewMomentStyles.momentAuthorContainer}>
                    <Image
                        source={{ uri: `https://robohash.org/${moment.fromUserId}?size=50x50` }}
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
                </View>
                <UserMedia
                    viewportWidth={viewportWidth}
                    media={momentMedia}
                    isVisible={momentMedia}
                    overlayMsg={isExpanded ? undefined : sanitizeNotificationMsg(moment.notificationMsg)}
                />
                <Text style={this.viewMomentStyles.momentMessage}>
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
                        visibleCount={20}
                    />
                </View>
            </>
        );
    }
}
