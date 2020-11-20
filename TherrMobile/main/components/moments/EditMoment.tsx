import React from 'react';
import { connect } from 'react-redux';
import { View, ScrollView, Text, TextInput } from 'react-native';
import { Button, Input } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MapActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import { editMomentModal } from '../../styles/modal';
import formStyles, { editMomentForm as editMomentFormStyles } from '../../styles/forms';
import Alert from '../Alert';
import { bindActionCreators } from 'redux';

interface IEditMomentDispatchProps {
    createMoment: Function;
}

interface IStoreProps extends IEditMomentDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IEditMomentProps extends IStoreProps {
    closeOverlay: any
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
            user,
            translate,
        } = this.props;

        const createArgs: any = {
            fromUserId: user.details.id,
            message,
            notificationMsg,
            hashTags,
            maxViews,
            expiresAt,
        };

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });
            this.props
                .createMoment(user.details.id, createArgs)
                .then(() => {
                    this.setState({
                        successMsg: translate('forms.editMoment.backendSuccessMessage'),
                    });
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
                    this.scrollViewRef.scrollTo({y: 0});
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
                            {translate('components.momentsOverlay.headerTitle')}
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
                        <Alert
                            containerStyles={{
                                marginBottom: 24,
                            }}
                            isVisible={!!(errorMsg || successMsg)}
                            message={successMsg || errorMsg}
                            type={errorMsg ? 'error' : 'success'}
                        />
                        <TextInput
                            style={formStyles.textInputAlt}
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
                            inputStyle={formStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.notificationMsg'
                            )}
                            value={inputs.notificationMsg}
                            onChangeText={(text) =>
                                this.onInputChange('notificationMsg', text)
                            }
                        />
                        <Input
                            inputStyle={formStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.hashTags'
                            )}
                            value={inputs.hashTags}
                            onChangeText={(text) =>
                                this.onInputChange('hashTags', text)
                            }
                        />
                        <Input
                            inputStyle={formStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.maxViews'
                            )}
                            value={inputs.maxViews}
                            onChangeText={(text) =>
                                this.onInputChange('maxViews', text)
                            }
                        />
                        <Input
                            inputStyle={formStyles.inputAlt}
                            placeholder={translate(
                                'forms.editMoment.labels.expiresAt'
                            )}
                            value={inputs.expiresAt}
                            onChangeText={(text) =>
                                this.onInputChange('expiresAt', text)
                            }
                        />
                    </View>
                </ScrollView>
                <View style={editMomentModal.footer} />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditMoment);
