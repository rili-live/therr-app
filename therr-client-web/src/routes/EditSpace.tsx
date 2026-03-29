/* eslint-disable max-len */
import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { NavigateFunction } from 'react-router-dom';
import {
    Alert, Card, Container, Stack, Textarea, FileInput,
} from '@mantine/core';
import {
    MantineButton,
    MantineInput,
    MantineSelect,
} from 'therr-react/components/mantine';
import { IMapState, IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { Categories } from 'therr-js-utilities/constants';
import withNavigation from '../wrappers/withNavigation';
import withTranslation from '../wrappers/withTranslation';

const categoryOptions = Categories.SpaceCategories.map((cat: string) => ({
    value: cat,
    label: cat.replace('categories.', '').replace('/', ' / ').replace(/^\w/, (c) => c.toUpperCase()),
}));

interface IEditSpaceRouterProps {
    navigation: {
        navigate: NavigateFunction;
    };
    routeParams: {
        spaceId: string;
    };
}

interface IEditSpaceDispatchProps {
    updateSpace: Function;
}

interface IStoreProps extends IEditSpaceDispatchProps {
    map: IMapState;
    user: IUserState;
}

interface IEditSpaceProps extends IEditSpaceRouterProps, IStoreProps {
    translate: (key: string, params?: any) => string;
}

interface IEditSpaceState {
    inputs: {
        notificationMsg: string;
        message: string;
        addressReadable: string;
        category: string;
        hashTags: string;
        phoneNumber: string;
        websiteUrl: string;
        menuUrl: string;
        orderUrl: string;
        reservationUrl: string;
    };
    imageFile: File | null;
    isLoading: boolean;
    isSubmitting: boolean;
    errorReason: string;
    isSuccess: boolean;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    updateSpace: MapActions.updateSpace,
}, dispatch);

/**
 * EditSpace
 */
export class EditSpaceComponent extends React.Component<IEditSpaceProps, IEditSpaceState> {
    constructor(props: IEditSpaceProps) {
        super(props);

        this.state = {
            inputs: {
                notificationMsg: '',
                message: '',
                addressReadable: '',
                category: '',
                hashTags: '',
                phoneNumber: '',
                websiteUrl: '',
                menuUrl: '',
                orderUrl: '',
                reservationUrl: '',
            },
            imageFile: null,
            isLoading: true,
            isSubmitting: false,
            errorReason: '',
            isSuccess: false,
        };
    }

    componentDidMount() {
        const { routeParams, map, user } = this.props;
        const { spaceId } = routeParams;

        if (!spaceId) {
            this.props.navigation.navigate('/user/profile');
            return;
        }

        document.title = `Therr | ${this.props.translate('pages.editSpace.pageTitle')}`;

        const existingSpace = map?.spaces?.[spaceId];
        if (existingSpace?.message) {
            if (existingSpace.fromUserId !== user.details?.id) {
                this.props.navigation.navigate('/user/profile');
                return;
            }
            this.populateFromSpace(existingSpace);
        } else {
            MapsService.getSpaceDetails(spaceId as any, {
                withMedia: false,
                withUser: false,
            }).then((response: any) => {
                const space = response?.data?.space;
                if (space) {
                    if (space.fromUserId !== user.details?.id) {
                        this.props.navigation.navigate('/user/profile');
                        return;
                    }
                    this.populateFromSpace(space);
                } else {
                    this.props.navigation.navigate('/user/profile');
                }
            }).catch(() => {
                this.setState({ isLoading: false });
                this.props.navigation.navigate('/user/profile');
            });
        }
    }

    populateFromSpace = (space: any) => {
        this.setState({
            inputs: {
                notificationMsg: space.notificationMsg || '',
                message: space.message || '',
                addressReadable: space.addressReadable || '',
                category: space.category || '',
                hashTags: space.hashTags || '',
                phoneNumber: space.phoneNumber || '',
                websiteUrl: space.websiteUrl || '',
                menuUrl: space.menuUrl || '',
                orderUrl: space.orderUrl || '',
                reservationUrl: space.reservationUrl || '',
            },
            isLoading: false,
        });
    };

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

    onCategoryChange = (value: string | null) => {
        this.setState({
            inputs: {
                ...this.state.inputs,
                category: value || '',
            },
            errorReason: '',
            isSuccess: false,
        });
    };

    onImageChange = (file: File | null) => {
        this.setState({ imageFile: file });
    };

    isFormDisabled = () => {
        const { inputs, isSubmitting } = this.state;
        return isSubmitting || !inputs.notificationMsg;
    };

    onSubmit = (event: any) => {
        event.preventDefault();

        if (this.isFormDisabled()) return;

        const { routeParams, updateSpace } = this.props;
        const { inputs, imageFile } = this.state;
        const { spaceId } = routeParams;

        this.setState({ isSubmitting: true, errorReason: '', isSuccess: false });

        const updateArgs: any = {
            notificationMsg: inputs.notificationMsg,
            message: inputs.message,
            addressReadable: inputs.addressReadable,
            category: inputs.category,
            hashTags: inputs.hashTags,
            phoneNumber: inputs.phoneNumber,
            websiteUrl: inputs.websiteUrl,
            menuUrl: inputs.menuUrl,
            orderUrl: inputs.orderUrl,
            reservationUrl: inputs.reservationUrl,
        };

        const imageUploadPromise = imageFile
            ? MapsService.getSignedUrlPublicBucket({
                action: 'write',
                filename: `spaces/${spaceId}/${imageFile.name}`,
                areaType: 'spaces',
            }).then((response: any) => {
                const signedUrl = response?.data?.url;
                if (signedUrl) {
                    return fetch(signedUrl, {
                        method: 'PUT',
                        body: imageFile,
                        headers: { 'Content-Type': imageFile.type },
                    }).then(() => {
                        updateArgs.medias = [{
                            type: 'USER_IMAGE_PUBLIC',
                            path: `spaces/${spaceId}/${imageFile.name}`,
                        }];
                    });
                }
                return undefined;
            })
            : Promise.resolve();

        imageUploadPromise.then(() => updateSpace(spaceId, updateArgs)).then(() => {
            this.setState({ isSuccess: true, errorReason: '' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }).catch((error: any) => {
            if (error.statusCode === 400) {
                this.setState({ errorReason: 'BadRequest' });
            } else {
                this.setState({ errorReason: 'ServerError' });
            }
        }).finally(() => {
            this.setState({ isSubmitting: false });
        });
    };

    navigateBack = () => {
        this.props.navigation.navigate('/user/profile');
    };

    public render(): JSX.Element | null {
        const { translate } = this.props;
        const {
            errorReason, inputs, isLoading, isSuccess, isSubmitting,
        } = this.state;

        if (isLoading) {
            return (
                <div id="page_edit_space">
                    <Container size="sm">
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                            <Stack gap="md">
                                <h1>{translate('pages.editSpace.pageTitle')}</h1>
                            </Stack>
                        </Card>
                    </Container>
                </div>
            );
        }

        return (
            <div id="page_edit_space">
                <Container size="sm">
                    <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Stack gap="md">
                            <h1>{translate('pages.editSpace.pageTitle')}</h1>

                            {!errorReason && isSuccess && (
                                <Alert color="green" variant="light">
                                    {translate('pages.editSpace.successMessage')}
                                </Alert>
                            )}
                            {errorReason === 'BadRequest' && (
                                <Alert color="red" variant="light">
                                    {translate('pages.editSpace.failedMessageBadRequest')}
                                </Alert>
                            )}
                            {errorReason === 'ServerError' && (
                                <Alert color="red" variant="light">
                                    {translate('pages.editSpace.failedMessageServer')}
                                </Alert>
                            )}

                            <h2 className="edit-profile-section-title">
                                {translate('pages.editSpace.h2.basicInfo')}
                            </h2>

                            <MantineInput
                                id="notification_msg"
                                name="notificationMsg"
                                value={inputs.notificationMsg}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                validations={['isRequired']}
                                label={translate('pages.editSpace.labels.name')}
                            />

                            <Textarea
                                id="space_message"
                                label={translate('pages.editSpace.labels.description')}
                                value={inputs.message}
                                onChange={this.onTextareaChange('message')}
                                autosize
                                minRows={3}
                                maxRows={6}
                            />

                            <MantineInput
                                id="address_readable"
                                name="addressReadable"
                                value={inputs.addressReadable}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.editSpace.labels.address')}
                            />

                            <MantineSelect
                                id="edit_space_category"
                                label={translate('pages.editSpace.labels.category')}
                                value={inputs.category}
                                onChange={this.onCategoryChange}
                                data={categoryOptions}
                                placeholder={translate('pages.editSpace.labels.selectCategory')}
                            />

                            <MantineInput
                                id="edit_space_hashTags"
                                name="hashTags"
                                value={inputs.hashTags}
                                onChange={this.onInputChange}
                                label={translate('pages.editSpace.labels.hashTags')}
                                description={translate('pages.editSpace.labels.hashTagsHint')}
                            />

                            <FileInput
                                label={translate('pages.editSpace.labels.image')}
                                accept="image/*"
                                onChange={this.onImageChange}
                                placeholder={translate('pages.editSpace.labels.chooseImage')}
                                clearable
                            />

                            <h2 className="edit-profile-section-title">
                                {translate('pages.editSpace.h2.contactLinks')}
                            </h2>

                            <MantineInput
                                id="phone_number"
                                name="phoneNumber"
                                value={inputs.phoneNumber}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.editSpace.labels.phoneNumber')}
                            />

                            <MantineInput
                                id="website_url"
                                name="websiteUrl"
                                value={inputs.websiteUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.editSpace.labels.websiteUrl')}
                            />

                            <MantineInput
                                id="menu_url"
                                name="menuUrl"
                                value={inputs.menuUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.editSpace.labels.menuUrl')}
                            />

                            <MantineInput
                                id="order_url"
                                name="orderUrl"
                                value={inputs.orderUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.editSpace.labels.orderUrl')}
                            />

                            <MantineInput
                                id="reservation_url"
                                name="reservationUrl"
                                value={inputs.reservationUrl}
                                onChange={this.onInputChange}
                                onEnter={this.onSubmit}
                                translateFn={translate}
                                label={translate('pages.editSpace.labels.reservationUrl')}
                            />

                            <div className="edit-profile-actions">
                                <MantineButton
                                    id="back_to_profile"
                                    text={translate('pages.editSpace.buttons.backToProfile')}
                                    onClick={this.navigateBack}
                                    variant="subtle"
                                />
                                <MantineButton
                                    id="save_space"
                                    text={translate('pages.editSpace.buttons.save')}
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

export default withNavigation(withTranslation(connect(mapStateToProps, mapDispatchToProps)(EditSpaceComponent)));
