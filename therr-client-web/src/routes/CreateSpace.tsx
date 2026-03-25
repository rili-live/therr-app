/* eslint-disable max-len */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Alert, Card, Container, Stack, Textarea,
} from '@mantine/core';
import {
    MantineButton,
    MantineInput,
} from 'therr-react/components/mantine';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

interface ICreateSpaceRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
}

interface ICreateSpaceDispatchProps {
    createSpace: Function;
}

interface IStoreProps extends ICreateSpaceDispatchProps {
    user: IUserState;
}

interface ICreateSpaceProps extends ICreateSpaceRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface ICreateSpaceState {
    inputs: {
        notificationMsg: string;
        message: string;
        addressReadable: string;
        latitude: string;
        longitude: string;
        phoneNumber: string;
        websiteUrl: string;
        menuUrl: string;
        orderUrl: string;
        reservationUrl: string;
    };
    isSubmitting: boolean;
    errorReason: string;
    isSuccess: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createSpace: MapActions.createSpace,
}, dispatch);

/**
 * CreateSpace
 */
export class CreateSpaceComponent extends React.Component<ICreateSpaceProps, ICreateSpaceState> {
    constructor(props: ICreateSpaceProps) {
        super(props);

        this.state = {
            inputs: {
                notificationMsg: '',
                message: '',
                addressReadable: '',
                latitude: '',
                longitude: '',
                phoneNumber: '',
                websiteUrl: '',
                menuUrl: '',
                orderUrl: '',
                reservationUrl: '',
            },
            isSubmitting: false,
            errorReason: '',
            isSuccess: false,
        };
    }

    componentDidMount() {
        document.title = `Therr | ${this.props.translate('pages.createSpace.pageTitle')}`;
    }

    onInputChange = (name: string, value: string) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: value,
            },
            errorReason: '',
            isSuccess: false,
        });
    };

    onTextareaChange = (name: string) => (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                [name]: event.target.value,
            },
            errorReason: '',
            isSuccess: false,
        });
    };

    isFormDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        return isSubmitting || !inputs.notificationMsg || !inputs.message;
    };

    onSubmit = (event: any) => {
        event.preventDefault();

        if (this.isFormDisabled()) return;

        const { createSpace, user } = this.props;
        const { inputs } = this.state;

        this.setState({ isSubmitting: true, errorReason: '', isSuccess: false });

        createSpace({
            fromUserId: user.details.id,
            locale: user.settings?.locale || 'en-us',
            isPublic: true,
            notificationMsg: inputs.notificationMsg,
            message: inputs.message,
            addressReadable: inputs.addressReadable,
            latitude: inputs.latitude || undefined,
            longitude: inputs.longitude || undefined,
            phoneNumber: inputs.phoneNumber,
            websiteUrl: inputs.websiteUrl,
            menuUrl: inputs.menuUrl,
            orderUrl: inputs.orderUrl,
            reservationUrl: inputs.reservationUrl,
        }).then(() => {
            this.props.navigation.navigate('/user/profile');
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({ errorReason: 'BadRequest', isSubmitting: false });
            } else {
                this.setState({ errorReason: 'ServerError', isSubmitting: false });
            }
        });
    };

    navigateBack = () => {
        this.props.navigation.navigate('/user/profile');
    };

    public render(): JSX.Element | null {
        const { translate } = this.props;
        const {
            errorReason, inputs, isSubmitting,
        } = this.state;

        return (
            <div id="page_create_space">
                <Container size="sm">
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stack gap="md">
                            <h1>{translate('pages.createSpace.pageTitle')}</h1>

                            {errorReason === 'BadRequest' && (
                                <Alert color="red" variant="light">
                                    {translate('pages.createSpace.failedMessageBadRequest')}
                                </Alert>
                            )}
                            {errorReason === 'ServerError' && (
                                <Alert color="red" variant="light">
                                    {translate('pages.createSpace.failedMessageServer')}
                                </Alert>
                            )}

                            <h2 className="edit-profile-section-title">
                                {translate('pages.createSpace.h2.basicInfo')}
                            </h2>

                            <MantineInput
                                id="notification_msg"
                                name="notificationMsg"
                                value={inputs.notificationMsg}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                validations={['isRequired']}
                                label={translate('pages.createSpace.labels.name')}
                            />

                            <Textarea
                                id="space_message"
                                label={translate('pages.createSpace.labels.description')}
                                value={inputs.message}
                                onChange={this.onTextareaChange('message')}
                                autosize
                                minRows={3}
                                maxRows={6}
                                required
                            />

                            <MantineInput
                                id="address_readable"
                                name="addressReadable"
                                value={inputs.addressReadable}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.address')}
                            />

                            <MantineInput
                                id="latitude"
                                name="latitude"
                                value={inputs.latitude}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.latitude')}
                            />

                            <MantineInput
                                id="longitude"
                                name="longitude"
                                value={inputs.longitude}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.longitude')}
                            />

                            <h2 className="edit-profile-section-title">
                                {translate('pages.createSpace.h2.contactLinks')}
                            </h2>

                            <MantineInput
                                id="phone_number"
                                name="phoneNumber"
                                value={inputs.phoneNumber}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.phoneNumber')}
                            />

                            <MantineInput
                                id="website_url"
                                name="websiteUrl"
                                value={inputs.websiteUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.websiteUrl')}
                            />

                            <MantineInput
                                id="menu_url"
                                name="menuUrl"
                                value={inputs.menuUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.menuUrl')}
                            />

                            <MantineInput
                                id="order_url"
                                name="orderUrl"
                                value={inputs.orderUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.orderUrl')}
                            />

                            <MantineInput
                                id="reservation_url"
                                name="reservationUrl"
                                value={inputs.reservationUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.createSpace.labels.reservationUrl')}
                            />

                            <div className="edit-profile-actions">
                                <MantineButton
                                    id="back_to_profile"
                                    text={translate('pages.createSpace.buttons.cancel')}
                                    onClick={this.navigateBack}
                                    variant="subtle"
                                />
                                <MantineButton
                                    id="create_space"
                                    text={translate('pages.createSpace.buttons.create')}
                                    onClick={this.onSubmit}
                                    disabled={this.isFormDisabled()}
                                    loading={isSubmitting}
                                />
                            </div>
                        </Stack>
                    </Card>
                </Container>
            </div>
        );
    }
}

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(CreateSpaceComponent)));
