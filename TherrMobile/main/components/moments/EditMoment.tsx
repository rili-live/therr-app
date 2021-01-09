import React from 'react';
import { connect } from 'react-redux';
import { Keyboard, View, ScrollView, Text, TextInput } from 'react-native';
import { Button, Input, Slider } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import YoutubePlayer from 'react-native-youtube-iframe';
import { MapActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import { editMomentModal } from '../../styles/modal';
import * as therrTheme from '../../styles/themes';
import formStyles, { editMomentForm as editMomentFormStyles } from '../../styles/forms';
import userContentStyles from '../../styles/user-content';
import Alert from '../Alert';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { youtubeLinkRegex } from '../../constants';

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
    closeOverlay: any;
    handleFullScreen: Function;
    latitude: any;
    longitude: string;
    translate: any;
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

class EditMoment extends React.Component<IEditMomentProps, IEditMomentState> {
    private scrollViewRef;

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
            latitude,
            longitude,
            user,
            translate,
        } = this.props;

        const createArgs: any = {
            fromUserId: user.details.id,
            message,
            notificationMsg,
            hashTags: hashtags.join(', '),
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
                        successMsg: translate('forms.editMoment.backendSuccessMessage'),
                    });
                    setTimeout(this.props.closeOverlay, 750);
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
                            errorMsg: translate('forms.editMoment.backendErrorMessage'),
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
        const modifiedHastags = [ ...hashtags ];
        let modifiedValue = value;
        const newInputChanges = {
            [name]: modifiedValue,
        };

        if (name === 'hashTags') {
            modifiedValue = modifiedValue.replace(/[^\w_,\s]/gi, '');

            const lastCharacter = modifiedValue.substring(modifiedValue.length - 1, modifiedValue.length);
            if (lastCharacter === ',' || lastCharacter === ' ') {
                const tag = modifiedValue.substring(0, modifiedValue.length - 1);
                if (modifiedHastags.length < 100 && !modifiedHastags.includes(tag)) {
                    modifiedHastags.push(modifiedValue.substring(0, modifiedValue.length - 1));
                }
                modifiedValue = '';
            }

            newInputChanges[name] = modifiedValue.trim();
        }

        if (name === 'message') {
            const match = value.match(youtubeLinkRegex);
            const previewLinkId = (match && match[1]) || undefined;
            this.setState({
                previewLinkId,
            });
        }

        this.setState({
            hashtags: modifiedHastags,
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

    renderHashtagPill = (tag, key) => {
        return (
            <Button
                key={key}
                buttonStyle={userContentStyles.buttonPill}
                containerStyle={userContentStyles.buttonPillContainer}
                titleStyle={userContentStyles.buttonPillTitle}
                title={`#${tag}`}
                icon={
                    <FontAwesome5Icon
                        name="times"
                        size={14}
                        style={userContentStyles.buttonPillIcon}
                    />
                }
                iconRight={true}
                onPress={() => this.handleHashtagPress(tag)}
            />
        );
    };

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
        this.props.handleFullScreen(isFullScreen);
    }

    render() {
        const { closeOverlay, translate } = this.props;
        const { errorMsg, successMsg, hashtags, inputs, previewLinkId, previewStyleState } = this.state;

        return (
            <>
                <View style={editMomentModal.header}>
                    <View style={editMomentModal.headerTitle}>
                        <Text style={editMomentModal.headerTitleText}>
                            {translate('components.editMomentOverlay.headerTitle')}
                        </Text>
                    </View>
                    <Button
                        icon={
                            <Icon
                                name="close"
                                size={30}
                                color="black"
                            />
                        }
                        onPress={closeOverlay}
                        type="clear"
                    />
                </View>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    ref={(component) => (this.scrollViewRef = component)}
                    style={editMomentModal.body}
                    contentContainerStyle={editMomentModal.bodyScroll}
                >
                    <View style={editMomentFormStyles.momentContainer}>
                        <TextInput
                            style={editMomentFormStyles.textInputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.message'
                            )}
                            value={inputs.message}
                            onChangeText={(text) =>
                                this.onInputChange('message', text)
                            }
                            numberOfLines={3}
                            multiline={true}
                        />
                        <Input
                            inputStyle={editMomentFormStyles.inputAlt}
                            errorStyle={{
                                display: 'none',
                            }}
                            placeholder={translate(
                                'forms.editMoment.labels.hashTags'
                            )}
                            value={inputs.hashTags}
                            onChangeText={(text) =>
                                this.onInputChange('hashTags', text)
                            }
                        />
                        {
                            <View style={userContentStyles.hashtagsContainer}>
                                {
                                    hashtags.map((tag, i) => this.renderHashtagPill(tag, i))
                                }
                            </View>
                        }
                        <Input
                            inputStyle={editMomentFormStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.notificationMsg'
                            )}
                            value={inputs.notificationMsg}
                            onChangeText={(text) =>
                                this.onInputChange('notificationMsg', text)
                            }
                        />
                        <View style={formStyles.inputSliderContainer}>
                            <Text style={formStyles.inputLabelDark}>
                                {`${translate('forms.editMoment.labels.radius', { meters: inputs.radius })}`}
                            </Text>
                            <Slider
                                value={inputs.radius}
                                onValueChange={(value) => this.onSliderChange('radius', value)}
                                maximumValue={MAX_RADIUS_PRIVATE}
                                minimumValue={MIN_RADIUS_PRIVATE}
                                step={1}
                                thumbStyle={{ backgroundColor: therrTheme.colors.beemoBlue }}
                                minimumTrackTintColor={therrTheme.colorVariations.beemoBlueLightFade}
                                maximumTrackTintColor={therrTheme.colorVariations.beemoBlueHeavyFade}
                            />
                        </View>
                        <Alert
                            containerStyles={{
                                marginBottom: 24,
                            }}
                            isVisible={!!(errorMsg || successMsg)}
                            message={successMsg || errorMsg}
                            type={errorMsg ? 'error' : 'success'}
                        />
                        {/* <Input
                            inputStyle={editMomentFormStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.maxProximity'
                            )}
                            value={inputs.maxProximity}
                            onChangeText={(text) =>
                                this.onInputChange('maxProximity', text)
                            }
                        />
                        {/* <Input
                            inputStyle={editMomentFormStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.maxViews'
                            )}
                            value={inputs.maxViews}
                            onChangeText={(text) =>
                                this.onInputChange('maxViews', text)
                            }
                        />
                        <Input
                            inputStyle={editMomentFormStyles.inputAlt}
                            placeholder={translate(
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
                            <Text style={editMomentFormStyles.previewHeader}>{translate('components.editMomentOverlay.previewHeader')}</Text>
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
                </ScrollView>
                <View style={editMomentModal.footer}>
                    <Button
                        buttonStyle={editMomentFormStyles.submitButton}
                        disabledStyle={editMomentFormStyles.submitButtonDisabled}
                        disabledTitleStyle={editMomentFormStyles.submitDisabledButtonTitle}
                        titleStyle={editMomentFormStyles.submitButtonTitle}
                        containerStyle={editMomentFormStyles.submitButtonContainer}
                        title={translate(
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
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditMoment);
