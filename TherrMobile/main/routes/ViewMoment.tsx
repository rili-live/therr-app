import React from 'react';
import { SafeAreaView, ActivityIndicator, Text, View, StatusBar } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Image } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Autolink from 'react-native-autolink';
// import { Button }  from 'react-native-elements';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import styles from '../styles';
import { viewing as viewMomentStyles } from '../styles/moments';
import * as therrTheme from '../styles/themes';
import { editMomentForm as editMomentFormStyles } from '../styles/forms';
import userContentStyles from '../styles/user-content';
import { youtubeLinkRegex } from '../constants';
// import * as therrTheme from '../styles/themes';
// import formStyles, { settingsForm as settingsFormStyles } from '../styles/forms';
// import BeemoInput from '../components/Input/Beemo';

export const DEFAULT_RADIUS = 10;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dev'];

interface IMomentDetails {
    userDetails?: any;
}

interface IViewMomentDispatchProps {
    deleteMoment: Function;
}

interface IStoreProps extends IViewMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IViewMomentProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewMomentState {
    errorMsg: string;
    successMsg: string;
    isDeleting: boolean;
    isVerifyingDelete: boolean;
    previewLinkId?: string;
    previewStyleState: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    deleteMoment: MapActions.deleteMoment,
}, dispatch);

export class ViewMoment extends React.Component<IViewMomentProps, IViewMomentState> {
    private date;
    private notificationMsg;
    private hashtags;
    private scrollViewRef;
    private translate: Function;

    constructor(props) {
        super(props);

        const { route } = props;
        const { moment } = route.params;

        const youtubeMatches = (moment.message || '').match(youtubeLinkRegex);

        this.state = {
            errorMsg: '',
            successMsg: '',
            isDeleting: false,
            isVerifyingDelete: false,
            previewStyleState: {},
            previewLinkId: youtubeMatches && youtubeMatches[1],
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);

        this.notificationMsg = (moment.notificationMsg || '').replace(/\r?\n+|\r+/gm, ' ');
        this.hashtags = moment.hashTags ? moment.hashTags.split(', ') : [];

        const date = new Date(moment.updatedAt);
        const year = date.getFullYear();
        const month = MONTHS[date.getMonth()];
        const day = date.getDate();
        let hours = date.getHours();
        hours = hours >= 12 ? hours - 11 : hours;
        const amPm = hours >= 12 ? 'PM' : 'AM';
        const minute = date.getMinutes().toString();

        this.date = `${day}-${month}-${year} ${hours}:${minute.padStart(2, '0')} ${amPm}`;
    }

    componentDidMount() {
        const { navigation} = this.props;

        navigation.setOptions({
            title: this.notificationMsg,
        });
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
        const { deleteMoment, navigation, route, user } = this.props;
        const { moment } = route.params;

        this.setState({
            isDeleting: true,
        });
        if (moment.fromUserId === user.details.id) {
            deleteMoment({ ids: [moment.id] })
                .then(() => {
                    console.log('Moment successfully deleted');
                    navigation.navigate('Map');
                })
                .catch((err) => {
                    console.log('Error deleting moment', err);
                    this.setState({
                        isDeleting: true,
                        isVerifyingDelete: false,
                    });
                });
        }
    }

    render() {
        const { isDeleting, isVerifyingDelete, previewLinkId, previewStyleState } = this.state;
        const { navigation, route } = this.props;
        const { moment, momentDetails, isMyMoment } = route.params;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView  style={styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[styles.bodyFlex, viewMomentStyles.body]}
                        contentContainerStyle={[styles.bodyScroll, viewMomentStyles.bodyScroll]}
                    >
                        <View style={viewMomentStyles.momentContainer}>
                            <Image
                                source={{ uri: `https://robohash.org/${moment.fromUserId}?size=200x200` }}
                                style={viewMomentStyles.momentUserAvatarImg}
                                PlaceholderContent={<ActivityIndicator size="large" color={therrTheme.colors.primary}/>}
                                transition={false}
                            />
                            {
                                momentDetails.userDetails &&
                                <Text style={viewMomentStyles.momentUserName}>
                                    {`${momentDetails.userDetails.firstName} ${momentDetails.userDetails.lastName}`}
                                </Text>
                            }
                            <Text style={viewMomentStyles.dateTime}>
                                {this.date}
                            </Text>
                            <Text style={viewMomentStyles.momentMessage}>
                                <Autolink
                                    text={moment.message}
                                    linkStyle={styles.link}
                                    phone="sms"
                                />
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
                                    height={260}
                                    play={false}
                                    videoId={previewLinkId}
                                    onFullScreenChange={this.handlePreviewFullScreen}
                                />
                            </View>
                        }
                    </KeyboardAwareScrollView>
                    {
                        <View style={viewMomentStyles.footer}>
                            <Button
                                containerStyle={editMomentFormStyles.backButtonContainer}
                                buttonStyle={editMomentFormStyles.backButton}
                                onPress={() => navigation.navigate('Map')}
                                icon={
                                    <FontAwesome5Icon
                                        name="arrow-left"
                                        size={25}
                                        color={'black'}
                                    />
                                }
                                type="clear"
                            />
                            {
                                isMyMoment &&
                                <>
                                    {
                                        !isVerifyingDelete &&
                                            <Button
                                                buttonStyle={editMomentFormStyles.submitDeleteButton}
                                                disabledStyle={editMomentFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                                                titleStyle={editMomentFormStyles.submitButtonTitle}
                                                containerStyle={editMomentFormStyles.submitButtonContainer}
                                                title={this.translate(
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
                                                raised={true}
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
                                                containerStyle={editMomentFormStyles.submitCancelButtonContainer}
                                                title={this.translate(
                                                    'forms.editMoment.buttons.cancel'
                                                )}
                                                onPress={this.onDeleteCancel}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                            <Button
                                                buttonStyle={editMomentFormStyles.submitConfirmButton}
                                                disabledStyle={editMomentFormStyles.submitButtonDisabled}
                                                disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                                                titleStyle={editMomentFormStyles.submitButtonTitleLight}
                                                containerStyle={editMomentFormStyles.submitButtonContainer}
                                                title={this.translate(
                                                    'forms.editMoment.buttons.confirm'
                                                )}
                                                onPress={this.onDeleteConfirm}
                                                disabled={isDeleting}
                                                raised={true}
                                            />
                                        </View>
                                    }
                                </>
                            }
                        </View>
                    }
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewMoment);
