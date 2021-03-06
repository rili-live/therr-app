import React from 'react';
import { SafeAreaView, Keyboard, Text, View, StatusBar } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Slider } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import styles, { addMargins } from '../styles';
import beemoLayoutStyles from '../styles/layouts/beemo';
import * as therrTheme from '../styles/themes';
import formStyles, { beemoEditForm as editMomentFormStyles } from '../styles/forms';
import userContentStyles from '../styles/user-content';
import { youtubeLinkRegex } from '../constants';
import Alert from '../components/Alert';
import formatHashtags from '../utilities/formatHashtags';
import BeemoInput from '../components/Input/Beemo';
import BeemoTextInput from '../components/TextInput/Beemo';
import HashtagsContainer from '../components/UserContent/HashtagsContainer';

export const DEFAULT_RADIUS = 10;
export const MIN_RADIUS_PRIVATE = 3;
export const MAX_RADIUS_PRIVATE = 25;
export const MIN_RADIUS_PUBLIC = 3;
export const MAX_RADIUS_PUBLIC = 50;

interface IEditMomentDispatchProps {
    createMoment: Function;
}

interface IStoreProps extends IEditMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IEditMomentProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditMomentState {
    errorMsg: string;
    successMsg: string;
    hashtags: string[];
    inputs: any;
    isSubmitting: boolean;
    previewLinkId?: string;
    previewStyleState: any;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createMoment: MapActions.createMoment,
}, dispatch);

export class EditMoment extends React.Component<IEditMomentProps, IEditMomentState> {
    private scrollViewRef;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            errorMsg: '',
            successMsg: '',
            hashtags: [],
            inputs: {
                radius: DEFAULT_RADIUS,
            },
            isSubmitting: false,
            previewStyleState: {},
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.editMoment.headerTitle'),
        });
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.message ||
            isSubmitting
        );
    }

    onSubmit = () => {
        const { hashtags } = this.state;
        const {
            message,
            notificationMsg,
            maxViews,
            expiresAt,
            radius,
        } = this.state.inputs;
        const {
            route,
            user,
        } = this.props;
        const {
            latitude,
            longitude,
        } = route.params;

        const createArgs: any = {
            fromUserId: user.details.id,
            message,
            notificationMsg,
            hashTags: hashtags.join(','),
            latitude,
            longitude,
            maxViews,
            radius,
            expiresAt,
        };

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            this.props
                .createMoment(createArgs)
                .then(() => {
                    this.setState({
                        successMsg: this.translate('forms.editMoment.backendSuccessMessage'),
                    });
                    setTimeout(() => {
                        this.props.navigation.navigate('Map');
                    }, 500);
                })
                .catch((error: any) => {
                    if (
                        error.statusCode === 400 ||
                        error.statusCode === 401 ||
                        error.statusCode === 404
                    ) {
                        this.setState({
                            errorMsg: `${error.message}${
                                error.parameters
                                    ? '(' + error.parameters.toString() + ')'
                                    : ''
                            }`,
                        });
                    } else if (error.statusCode >= 500) {
                        this.setState({
                            errorMsg: this.translate('forms.editMoment.backendErrorMessage'),
                        });
                    }
                })
                .finally(() => {
                    Keyboard.dismiss();
                    this.scrollViewRef.scrollToEnd({ animated: true });
                });
        }
    };

    onInputChange = (name: string, value: string) => {
        const { hashtags } = this.state;
        let modifiedHashtags = [ ...hashtags ];
        let modifiedValue = value;
        const newInputChanges = {
            [name]: modifiedValue,
        };

        if (name === 'hashTags') {
            const { formattedValue, formattedHashtags } = formatHashtags(value, modifiedHashtags);

            modifiedHashtags = formattedHashtags;
            newInputChanges[name] = formattedValue;
        }

        if (name === 'message') {
            const match = value.match(youtubeLinkRegex);
            const previewLinkId = (match && match[1]) || undefined;
            this.setState({
                previewLinkId,
            });
        }

        this.setState({
            hashtags: modifiedHashtags,
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    };

    onSliderChange = (name, value) => {
        const newInputChanges = {
            [name]: value,
        };

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    }

    handleHashtagPress = (tag) => {
        const { hashtags } = this.state;
        let modifiedHastags = hashtags.filter(t => t !== tag);

        this.setState({
            hashtags: modifiedHastags,
        });
    }

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

    render() {
        const { navigation } = this.props;
        const { errorMsg, successMsg, hashtags, inputs, previewLinkId, previewStyleState } = this.state;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView style={styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[styles.bodyFlex, beemoLayoutStyles.bodyEdit]}
                        contentContainerStyle={[styles.bodyScroll, beemoLayoutStyles.bodyEditScroll]}
                    >
                        <View style={beemoLayoutStyles.container}>
                            <BeemoTextInput
                                placeholder={this.translate(
                                    'forms.editMoment.labels.message'
                                )}
                                value={inputs.message}
                                onChangeText={(text) =>
                                    this.onInputChange('message', text)
                                }
                                numberOfLines={3}
                            />
                            <BeemoInput
                                autoCorrect={false}
                                errorStyle={styles.displayNone}
                                placeholder={this.translate(
                                    'forms.editMoment.labels.hashTags'
                                )}
                                value={inputs.hashTags}
                                onChangeText={(text) =>
                                    this.onInputChange('hashTags', text)
                                }
                            />
                            <HashtagsContainer
                                hashtags={hashtags}
                                onHashtagPress={this.handleHashtagPress}
                            />
                            <BeemoInput
                                placeholder={this.translate(
                                    'forms.editMoment.labels.notificationMsg'
                                )}
                                value={inputs.notificationMsg}
                                onChangeText={(text) =>
                                    this.onInputChange('notificationMsg', text)
                                }
                            />
                            <View style={formStyles.inputSliderContainer}>
                                <Text style={formStyles.inputLabelDark}>
                                    {`${this.translate('forms.editMoment.labels.radius', { meters: inputs.radius })}`}
                                </Text>
                                <Slider
                                    value={inputs.radius}
                                    onValueChange={(value) => this.onSliderChange('radius', value)}
                                    maximumValue={MAX_RADIUS_PRIVATE}
                                    minimumValue={MIN_RADIUS_PRIVATE}
                                    step={1}
                                    thumbStyle={{ backgroundColor: therrTheme.colors.beemoBlue }}
                                    thumbTouchSize={{ width: 50, height: 50 }}
                                    minimumTrackTintColor={therrTheme.colorVariations.beemoBlueLightFade}
                                    maximumTrackTintColor={therrTheme.colorVariations.beemoBlueHeavyFade}
                                />
                            </View>
                            <Alert
                                containerStyles={addMargins({
                                    marginBottom: 24,
                                })}
                                isVisible={!!(errorMsg || successMsg)}
                                message={successMsg || errorMsg}
                                type={errorMsg ? 'error' : 'success'}
                            />
                            {/* <BeemoInput
                                placeholder={this.translate(
                                    'forms.editMoment.labels.maxProximity'
                                )}
                                value={inputs.maxProximity}
                                onChangeText={(text) =>
                                    this.onInputChange('maxProximity', text)
                                }
                            />
                            {/* <BeemoInput
                                placeholder={this.translate(
                                    'forms.editMoment.labels.maxViews'
                                )}
                                value={inputs.maxViews}
                                onChangeText={(text) =>
                                    this.onInputChange('maxViews', text)
                                }
                            />
                            <BeemoInput
                                placeholder={this.translate(
                                    'forms.editMoment.labels.expiresAt'
                                )}
                                value={inputs.expiresAt}
                                onChangeText={(text) =>
                                    this.onInputChange('expiresAt', text)
                                }
                            /> */}
                        </View>
                        {
                            !!previewLinkId
                            && <View style={[userContentStyles.preview, editMomentFormStyles.previewContainer, previewStyleState]}>
                                <Text style={editMomentFormStyles.previewHeader}>{this.translate('pages.editMoment.previewHeader')}</Text>
                                <View style={editMomentFormStyles.preview}>
                                    <YoutubePlayer
                                        height={300}
                                        play={false}
                                        videoId={previewLinkId}
                                        onFullScreenChange={this.handlePreviewFullScreen}
                                    />
                                </View>
                            </View>
                        }
                    </KeyboardAwareScrollView>
                    <View style={beemoLayoutStyles.footer}>
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
                        <Button
                            buttonStyle={editMomentFormStyles.submitButton}
                            disabledStyle={editMomentFormStyles.submitButtonDisabled}
                            disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                            titleStyle={editMomentFormStyles.submitButtonTitle}
                            containerStyle={editMomentFormStyles.submitButtonContainer}
                            title={this.translate(
                                'forms.editMoment.buttons.submit'
                            )}
                            icon={
                                <FontAwesome5Icon
                                    name="paper-plane"
                                    size={25}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={editMomentFormStyles.submitButtonIcon}
                                />
                            }
                            onPress={this.onSubmit}
                            disabled={this.isFormDisabled()}
                        />
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditMoment);
