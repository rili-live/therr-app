import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ActivityIndicator, View, ScrollView, Text } from 'react-native';
import { Button, Image } from 'react-native-elements';
import Autolink from 'react-native-autolink';
import Icon from 'react-native-vector-icons/MaterialIcons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { IUserState } from 'therr-react/types';
import { viewMomentModal } from '../../styles/modal';
import * as therrTheme from '../../styles/themes';
import styles from '../../styles';
import userContentStyles from '../../styles/user-content';
import { youtubeLinkRegex } from '../../constants';

export const DEFAULT_RADIUS = 10;

interface IMomentDetails {
    userDetails?: any;
}

interface IViewMomentDispatchProps {}

interface IStoreProps extends IViewMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IViewMomentProps extends IStoreProps {
    closeOverlay: any;
    handleFullScreen: Function;
    localeShort: string;
    moment: any;
    momentDetails: IMomentDetails;
    translate: any;
}

interface IViewMomentState {
    previewLinkId?: string;
    previewStyleState: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private date;

    private hashtags;

    private scrollViewRef;

    constructor(props) {
        super(props);

        const youtubeMatches = (props.moment.message || '').match(youtubeLinkRegex);

        this.state = {
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
        };

        this.hashtags = props.moment.hashTags ? props.moment.hashTags.split(', ') : [];

        const date = new Date(props.moment.updatedAt);
        const year = new Intl.DateTimeFormat(props.localeShort, { year: 'numeric' }).format(date);
        const month = new Intl.DateTimeFormat(props.localeShort, { month: 'short' }).format(date);
        const day = new Intl.DateTimeFormat(props.localeShort, { day: 'numeric' }).format(date);
        const hourSplit = new Intl.DateTimeFormat(props.localeShort, { hour: 'numeric' }).format(date).split(' ');
        const minute = new Intl.DateTimeFormat(props.localeShort, { hour: '2-digit' }).format(date);

        this.date = `${day}-${month}-${year} ${hourSplit[0]}:${minute}`;
    }

    renderHashtagPill = (tag, key) => {
        return (
            <Button
                key={key}
                buttonStyle={userContentStyles.buttonPill}
                containerStyle={userContentStyles.buttonPillContainer}
                titleStyle={userContentStyles.buttonPillTitle}
                title={`#${tag}`}
            />
        );
    };

    handlePreviewFullScreen = (isFullScreen) => {
        const previewStyleState = isFullScreen ? {
            top: 0,
            left: 0,
            padding: 0,
            margin: 0,
            position: 'absolute',
            zIndex: 20,
        } : {};
        this.setState({
            previewStyleState,
        });
        this.props.handleFullScreen(isFullScreen);
    }

    render() {
        const { previewLinkId, previewStyleState } = this.state;
        const { closeOverlay, moment, momentDetails } = this.props;

        return (
            <>
                <View style={viewMomentModal.header}>
                    <View style={viewMomentModal.headerTitle}>
                        <Text style={viewMomentModal.headerTitleText}>
                            {moment.notificationMsg}
                        </Text>
                    </View>
                    <Button
                        icon={
                            <Icon
                                name="close"
                                size={30}
                                color="black"
                                style={viewMomentModal.headerTitleIcon}
                            />
                        }
                        onPress={closeOverlay}
                        type="clear"
                    />
                </View>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={(component) => (this.scrollViewRef = component)}
                    style={viewMomentModal.body}
                    contentContainerStyle={viewMomentModal.bodyScroll}
                >
                    <View style={viewMomentModal.momentContainer}>
                        <Image
                            source={{ uri: `https://robohash.org/${moment.fromUserId}?size=200x200` }}
                            style={viewMomentModal.momentUserAvatarImg}
                            PlaceholderContent={<ActivityIndicator size="large" color={therrTheme.colors.primary}/>}
                            transition={false}
                        />
                        {
                            momentDetails.userDetails &&
                            <Text style={viewMomentModal.momentUserName}>{`${momentDetails.userDetails.firstName} ${momentDetails.userDetails.lastName}`}</Text>
                        }
                        <Text style={viewMomentModal.momentMessage}>
                            <Autolink
                                text={moment.message}
                                linkStyle={styles.link}
                                phone="sms"
                            />
                        </Text>
                        <Text style={viewMomentModal.dateTime}>
                            {this.date}
                        </Text>
                        <View>
                            <View style={userContentStyles.hashtagsContainer}>
                                {
                                    this.hashtags.map((tag, i) => this.renderHashtagPill(tag, i))
                                }
                            </View>
                        </View>
                    </View>
                    {
                        previewLinkId
                        && <View style={[userContentStyles.preview, previewStyleState]}>
                            <YoutubePlayer
                                height={300}
                                play={false}
                                videoId={previewLinkId}
                                onFullScreenChange={this.handlePreviewFullScreen}
                            />
                        </View>
                    }
                </ScrollView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
