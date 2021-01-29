import React from 'react';
import 'react-native-gesture-handler';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { ActivityIndicator, View, Text } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Button, Image } from 'react-native-elements';
import Autolink from 'react-native-autolink';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
import { IUserState } from 'therr-react/types';
import { viewMomentModal } from '../../styles/modal';
import * as therrTheme from '../../styles/themes';
import styles from '../../styles';
import { editMomentForm as editMomentFormStyles } from '../../styles/forms';
import userContentStyles from '../../styles/user-content';
import { youtubeLinkRegex } from '../../constants';

export const DEFAULT_RADIUS = 10;


const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dev'];

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
    isMyMoment: boolean;
    localeShort: string;
    onDelete: Function;
    moment: any;
    momentDetails: IMomentDetails;
    translate: any;
}

interface IViewMomentState {
    isDeleting: boolean;
    isVerifyingDelete: boolean;
    previewLinkId?: string;
    previewStyleState: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private date;

    private notificationMsg;

    private hashtags;

    private scrollViewRef;

    constructor(props) {
        super(props);

        const youtubeMatches = (props.moment.message || '').match(youtubeLinkRegex);

        this.state = {
            isDeleting: false,
            isVerifyingDelete: false,
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
        };

        this.notificationMsg = (props.moment.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = props.moment.hashTags ? props.moment.hashTags.split(', ') : [];

        const date = new Date(props.moment.updatedAt);
        const year = date.getFullYear();
        const month = MONTHS[date.getMonth()];
        const day = date.getDay();
        let hours = date.getHours();
        hours = hours >= 12 ? hours - 11 : hours;
        const amPm = hours >= 12 ? 'PM' : 'AM';
        const minute = date.getMinutes().toString();

        this.date = `${day}-${month}-${year} ${hours}:${minute.padStart(2, '0')} ${amPm}`;
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

    onDelete = () => {
        this.setState({
            isVerifyingDelete: true,
        });
    }

    onDeleteCancel = () => {
        this.setState({
            isVerifyingDelete: false,
        });
    }

    onDeleteConfirm = () => {
        this.setState({
            isDeleting: true,
        });
        this.props.closeOverlay();
        this.props.onDelete();
    }

    render() {
        const { isDeleting, isVerifyingDelete, previewLinkId, previewStyleState } = this.state;
        const { closeOverlay, isMyMoment, moment, momentDetails, translate } = this.props;

        return (
            <>
                <View style={viewMomentModal.header}>
                    <View style={viewMomentModal.headerTitle}>
                        <Text style={viewMomentModal.headerTitleText}>
                            {this.notificationMsg}
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
                <KeyboardAwareScrollView
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
                </KeyboardAwareScrollView>
                {
                    isMyMoment &&
                    <View style={viewMomentModal.footer}>
                        {
                            !isVerifyingDelete &&
                            <Button
                                buttonStyle={editMomentFormStyles.submitDeleteButton}
                                disabledStyle={editMomentFormStyles.submitButtonDisabled}
                                disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                                titleStyle={editMomentFormStyles.submitButtonTitle}
                                containerStyle={editMomentFormStyles.submitButtonContainer}
                                title={translate(
                                    'forms.editMoment.buttons.delete'
                                )}
                                icon={
                                    <FontAwesome5Icon
                                        name="trash-alt"
                                        size={25}
                                        color={'black'}
                                        style={editMomentFormStyles.submitButtonIcon}
                                    />
                                }
                                onPress={this.onDelete}
                            />
                        }
                        {
                            isVerifyingDelete &&
                            <View style={editMomentFormStyles.submitConfirmContainer}>
                                <Button
                                    buttonStyle={editMomentFormStyles.submitCancelButton}
                                    disabledStyle={editMomentFormStyles.submitButtonDisabled}
                                    disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                                    titleStyle={editMomentFormStyles.submitButtonTitle}
                                    containerStyle={editMomentFormStyles.submitButtonContainer}
                                    title={translate(
                                        'forms.editMoment.buttons.cancel'
                                    )}
                                    onPress={this.onDeleteCancel}
                                    disabled={isDeleting}
                                />
                                <Button
                                    buttonStyle={editMomentFormStyles.submitConfirmButton}
                                    disabledStyle={editMomentFormStyles.submitButtonDisabled}
                                    disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                                    titleStyle={editMomentFormStyles.submitButtonTitleLight}
                                    containerStyle={editMomentFormStyles.submitButtonContainer}
                                    title={translate(
                                        'forms.editMoment.buttons.confirm'
                                    )}
                                    onPress={this.onDeleteConfirm}
                                    disabled={isDeleting}
                                />
                            </View>
                        }
                    </View>
                }
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
