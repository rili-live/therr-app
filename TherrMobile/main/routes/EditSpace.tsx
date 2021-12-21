import React from 'react';
import { Platform, Pressable, SafeAreaView, Keyboard, Text, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Button, Slider, Image } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import RNFB from 'rn-fetch-blob';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import { MapsService } from 'therr-react/services';
import { Content } from 'therr-js-utilities/constants';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import YoutubePlayer from 'react-native-youtube-iframe';
import DropDown from '../components/Input/DropDown';
// import Alert from '../components/Alert';
import translator from '../services/translator';
import styles, { addMargins } from '../styles';
import beemoLayoutStyles from '../styles/layouts/beemo';
import * as therrTheme from '../styles/themes';
import formStyles, { beemoEditForm as editSpaceFormStyles } from '../styles/forms';
import editSpaceStyles from '../styles/user-content/moments/editing';
import userContentStyles from '../styles/user-content';
import {
    youtubeLinkRegex,
    DEFAULT_RADIUS,
    MIN_RADIUS_PUBLIC,
    MAX_RADIUS_PUBLIC,
} from '../constants';
import Alert from '../components/Alert';
import formatHashtags from '../utilities/formatHashtags';
import BeemoInput from '../components/Input/Beemo';
import BeemoTextInput from '../components/TextInput/Beemo';
import HashtagsContainer from '../components/UserContent/HashtagsContainer';
import BaseStatusBar from '../components/BaseStatusBar';
import { getImagePreviewPath } from '../utilities/areaUtils';

interface IEditSpaceDispatchProps {
    createSpace: Function;
}

interface IStoreProps extends IEditSpaceDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IEditSpaceProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditSpaceState {
    errorMsg: string;
    successMsg: string;
    hashtags: string[];
    inputs: any;
    isSubmitting: boolean;
    previewLinkId?: string;
    previewStyleState: any;
    imagePreviewPath: string;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createSpace: MapActions.createSpace,
}, dispatch);

export class EditSpace extends React.Component<IEditSpaceProps, IEditSpaceState> {
    private categoryOptions: any[];
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;

    constructor(props) {
        super(props);

        const { route } = props;
        const { imageDetails } = route.params;
        const { croppedImage } = imageDetails || {};
        const imageURI = croppedImage?.uri || imageDetails?.uri;

        this.state = {
            errorMsg: '',
            successMsg: '',
            hashtags: [],
            inputs: {
                isPublic: true,
                radius: DEFAULT_RADIUS,
            },
            isSubmitting: false,
            previewStyleState: {},
            imagePreviewPath: getImagePreviewPath(imageURI),
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
        this.categoryOptions = [
            {
                id: 1,
                label: this.translate('forms.editMoment.categories.uncategorized'),
                value: 'uncategorized',
            },
            {
                id: 2,
                label: this.translate('forms.editMoment.categories.music'),
                value: 'music',
            },
            {
                id: 3,
                label: this.translate('forms.editMoment.categories.deals'),
                value: 'deals',
            },
            {
                id: 4,
                label: this.translate('forms.editMoment.categories.storefront'),
                value: 'storefront',
            },
            {
                id: 5,
                label: this.translate('forms.editMoment.categories.idea'),
                value: 'idea',
            },
            {
                id: 6,
                label: this.translate('forms.editMoment.categories.food'),
                value: 'food',
            },
        ];
        // changeNavigationBarColor(therrTheme.colors.beemo1, false, true);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.editSpace.headerTitle'),
        });

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            // changeNavigationBarColor(therrTheme.colors.primary, false, true);
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    isFormDisabled() {
        const { inputs, isSubmitting } = this.state;

        return (
            !inputs.message ||
            isSubmitting
        );
    }

    signImageUrl = (createArgs) => {
        const {
            message,
            notificationMsg,
            isPublic,
        } = this.state.inputs;
        const {
            route,
        } = this.props;
        const {
        } = route.params;
        const { imageDetails } = route.params;
        const { croppedImage } = imageDetails || {};

        const signUrl = isPublic ? MapsService.getSignedUrlPublicBucket : MapsService.getSignedUrlPrivateBucket;

        // TODO: This is too slow
        // Use public method for public spaces
        return signUrl({
            action: 'write',
            filename: `content/${(notificationMsg || message.substring(0, 20)).replace(/[^a-zA-Z0-9]/g,'_')}.jpg`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];
            createArgs.media = [{}];
            createArgs.media[0].type = isPublic ? Content.mediaTypes.USER_IMAGE_PUBLIC : Content.mediaTypes.USER_IMAGE_PRIVATE;
            createArgs.media[0].path = response?.data?.path;

            const localFilePath = Platform.OS === 'ios' ? imageDetails.uri.replace('file:///', '') : imageDetails.uri;
            const localFileCroppedPath = Platform.OS === 'ios' ? imageDetails.uri.replace('file:///', '').replace('file:/', '') : croppedImage?.uri;

            // Upload to Google Cloud
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': imageDetails.type,
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(localFileCroppedPath || localFilePath),
            ).then(() => createArgs);
        });
    }

    onSubmit = () => {
        const { hashtags } = this.state;
        const {
            category,
            message,
            notificationMsg,
            maxViews,
            expiresAt,
            radius,
            isPublic,
        } = this.state.inputs;
        const {
            navigation,
            route,
            user,
        } = this.props;
        const {
            latitude,
            longitude,
        } = route.params;
        const { imageDetails } = route.params;
        const { croppedImage } = imageDetails || {};

        const createArgs: any = {
            category,
            fromUserId: user.details.id,
            isPublic,
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

            (croppedImage ? this.signImageUrl(createArgs) : Promise.resolve(createArgs)).then((modifiedCreateArgs) => {
                this.props
                    .createSpace(modifiedCreateArgs)
                    .then(() => {
                        this.setState({
                            successMsg: this.translate('forms.editSpace.backendSuccessMessage'),
                        });
                        setTimeout(() => {
                            this.props.navigation.navigate('Map');
                        }, 500);
                    })
                    .catch((error: any) => {
                        // TODO: Delete uploaded file on failure to create
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
                                errorMsg: this.translate('forms.editSpace.backendErrorMessage'),
                            });
                        }
                    })
                    .finally(() => {
                        Keyboard.dismiss();
                        this.scrollViewRef.scrollToEnd({ animated: true });
                    });
            }).catch((err) => {
                console.log(err);
                return navigation.navigate('Map');
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

    handleHashTagsBlur = () => {
        const { hashtags, inputs } = this.state;

        if (inputs.hashTags?.trim().length) {
            const { formattedValue, formattedHashtags } = formatHashtags(`${inputs.hashTags},`, [...hashtags]);

            this.setState({
                hashtags: formattedHashtags,
                inputs: {
                    ...inputs,
                    hashTags: formattedValue,
                },
            });
        }
    }

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
        const { errorMsg, successMsg, hashtags, inputs, previewLinkId, previewStyleState, imagePreviewPath } = this.state;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        keyboardShouldPersistTaps="always"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={[styles.bodyFlex, beemoLayoutStyles.bodyEdit]}
                        contentContainerStyle={[styles.bodyScroll, beemoLayoutStyles.bodyEditScroll]}
                    >
                        <Pressable style={beemoLayoutStyles.container} onPress={Keyboard.dismiss}>
                            {
                                !!imagePreviewPath &&
                                <View style={editSpaceStyles.mediaContainer}>
                                    <Image
                                        source={{ uri: imagePreviewPath }}
                                        style={editSpaceStyles.mediaImage}
                                    />
                                </View>
                            }
                            <BeemoInput
                                maxLength={100}
                                placeholder={this.translate(
                                    'forms.editSpace.labels.notificationMsg'
                                )}
                                value={inputs.notificationMsg}
                                onChangeText={(text) =>
                                    this.onInputChange('notificationMsg', text)
                                }
                            />
                            <BeemoTextInput
                                placeholder={this.translate(
                                    'forms.editSpace.labels.message'
                                )}
                                value={inputs.message}
                                onChangeText={(text) =>
                                    this.onInputChange('message', text)
                                }
                                numberOfLines={5}
                            />
                            <View style={[formStyles.input, { display: 'flex', flexDirection: 'row', alignItems: 'center' }]}>
                                <DropDown
                                    onChange={(newValue) =>
                                        this.onInputChange('category', newValue || 'uncategorized')
                                    }
                                    options={this.categoryOptions}
                                />
                            </View>
                            <BeemoInput
                                autoCorrect={false}
                                errorStyle={styles.displayNone}
                                placeholder={this.translate(
                                    'forms.editSpace.labels.hashTags'
                                )}
                                value={inputs.hashTags}
                                onChangeText={(text) =>
                                    this.onInputChange('hashTags', text)
                                }
                                onBlur={this.handleHashTagsBlur}
                            />
                            <HashtagsContainer
                                hashtags={hashtags}
                                onHashtagPress={this.handleHashtagPress}
                            />
                            <View style={formStyles.inputSliderContainer}>
                                <Slider
                                    value={inputs.radius}
                                    onValueChange={(value) => this.onSliderChange('radius', value)}
                                    maximumValue={MAX_RADIUS_PUBLIC}
                                    minimumValue={MIN_RADIUS_PUBLIC}
                                    step={1}
                                    thumbStyle={{ backgroundColor: therrTheme.colors.beemoBlue }}
                                    thumbTouchSize={{ width: 100, height: 100 }}
                                    minimumTrackTintColor={therrTheme.colorVariations.beemoBlueLightFade}
                                    maximumTrackTintColor={therrTheme.colorVariations.beemoBlueHeavyFade}
                                    onSlidingStart={Keyboard.dismiss}
                                />
                                <Text style={formStyles.inputLabelDark}>
                                    {`${this.translate('forms.editSpace.labels.radius', { meters: inputs.radius })}`}
                                </Text>
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
                                    'forms.editSpace.labels.maxProximity'
                                )}
                                value={inputs.maxProximity}
                                onChangeText={(text) =>
                                    this.onInputChange('maxProximity', text)
                                }
                            />
                            {/* <BeemoInput
                                placeholder={this.translate(
                                    'forms.editSpace.labels.maxViews'
                                )}
                                value={inputs.maxViews}
                                onChangeText={(text) =>
                                    this.onInputChange('maxViews', text)
                                }
                            />
                            <BeemoInput
                                placeholder={this.translate(
                                    'forms.editSpace.labels.expiresAt'
                                )}
                                value={inputs.expiresAt}
                                onChangeText={(text) =>
                                    this.onInputChange('expiresAt', text)
                                }
                            /> */}
                        </Pressable>
                        {
                            !!previewLinkId
                            && <View style={[userContentStyles.preview, editSpaceFormStyles.previewContainer, previewStyleState]}>
                                <Text style={editSpaceFormStyles.previewHeader}>{this.translate('pages.editSpace.previewHeader')}</Text>
                                <View style={editSpaceFormStyles.preview}>
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
                            containerStyle={editSpaceFormStyles.backButtonContainer}
                            buttonStyle={editSpaceFormStyles.backButton}
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
                            buttonStyle={editSpaceFormStyles.submitButton}
                            disabledStyle={editSpaceFormStyles.submitButtonDisabled}
                            disabledTitleStyle={editSpaceFormStyles.submitDisabledButtonTitle}
                            titleStyle={editSpaceFormStyles.submitButtonTitle}
                            containerStyle={editSpaceFormStyles.submitButtonContainer}
                            title={this.translate(
                                'forms.editSpace.buttons.submit'
                            )}
                            icon={
                                <FontAwesome5Icon
                                    name="paper-plane"
                                    size={25}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={editSpaceFormStyles.submitButtonIcon}
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

export default connect(mapStateToProps, mapDispatchToProps)(EditSpace);
