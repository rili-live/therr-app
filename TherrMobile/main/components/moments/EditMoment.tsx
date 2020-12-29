import React from 'react';
import { connect } from 'react-redux';
import { Keyboard, View, ScrollView, Text, TextInput } from 'react-native';
import { Button, Input } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MapActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import { editMomentModal } from '../../styles/modal';
import { editMomentForm as editMomentFormStyles } from '../../styles/forms';
import Alert from '../Alert';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';

export const DEFAULT_RADIUS = 10;

interface IEditMomentDispatchProps {
    createMoment: Function;
}

interface IStoreProps extends IEditMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IEditMomentProps extends IStoreProps {
    closeOverlay: any;
    latitude: any;
    longitude: string;
    translate: any;
}

interface IEditMomentState {
    errorMsg: string;
    successMsg: string;
    inputs: any;
    isSubmitting: boolean;
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
            inputs: {},
            isSubmitting: false,
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
        const {
            message,
            notificationMsg,
            hashTags,
            maxViews,
            expiresAt,
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
            hashTags,
            latitude,
            longitude,
            maxViews,
            radius: DEFAULT_RADIUS,
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
        const newInputChanges = {
            [name]: value,
        };

        if (name === 'hashTags') {
            let modifiedValue = value.replace(/#/g, '');
            modifiedValue = `#${modifiedValue}`;
            newInputChanges[name] = modifiedValue.trim();
        }

        this.setState({
            inputs: {
                ...this.state.inputs,
                ...newInputChanges,
            },
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        });
    };

    render() {
        const { closeOverlay, translate } = this.props;
        const { errorMsg, successMsg, inputs } = this.state;

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
                            placeholder={translate(
                                'forms.editMoment.labels.hashTags'
                            )}
                            value={inputs.hashTags}
                            onChangeText={(text) =>
                                this.onInputChange('hashTags', text)
                            }
                        />
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
                                'forms.editMoment.labels.minProximity'
                            )}
                            value={inputs.minProximity}
                            onChangeText={(text) =>
                                this.onInputChange('minProximity', text)
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
