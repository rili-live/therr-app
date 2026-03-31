import React from 'react';
import { Dimensions, Keyboard, Platform, SafeAreaView, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import RNFB from 'react-native-blob-util';
import { showToast } from '../../utilities/toasts';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { ForumActions } from 'therr-react/redux/actions';
import { Content, ErrorCodes, FilePaths } from 'therr-js-utilities/constants';
import { IContentState, IForumsState, IUserState } from 'therr-react/types';
import ImageCropPicker from 'react-native-image-crop-picker';
import OctIcon from 'react-native-vector-icons/Octicons';
import { SheetManager } from 'react-native-actions-sheet';
import translator from '../../services/translator';
import { isDarkTheme } from '../../styles/themes';
import { buildStyles } from '../../styles';
import { buildStyles as buildCategoryStyles } from '../../styles/user-content/groups/categories';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import formatHashtags from '../../utilities/formatHashtags';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import EditFormFooter from '../../components/EditFormFooter';
import GroupCategories from './GroupCategories';
import BaseStatusBar from '../../components/BaseStatusBar';
import { Button } from '../../components/BaseButton';
import { Image } from '../../components/BaseImage';
import TherrIcon from '../../components/TherrIcon';
import RoundInput from '../../components/Input/Round';
import RoundTextInput from '../../components/Input/TextInput/Round';
import spacingStyles from '../../styles/layouts/spacing';
import { GROUPS_CAROUSEL_TABS } from '../../constants';
import InputGroupName from './InputGroupName';
import CityAutocompleteInput from '../../components/Input/CityAutocompleteInput';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { signImageUrl } from '../../utilities/content';
import { requestOSCameraPermissions } from '../../utilities/requestOSPermissions';

const { width: viewportWidth } = Dimensions.get('window');

interface IEditChatDispatchProps {
    logout: Function;
    createForum: Function;
    updateForum: Function;
    searchCategories: Function;
}

interface IStoreProps extends IEditChatDispatchProps {
    content: IContentState;
    forums: IForumsState;
    user: IUserState;
}

// Regular component props
export interface IEditChatProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditChatState {
    groupId: string;
    categories: any[];
    errorMsg: string;
    successMsg: string;
    toggleChevronName: string;
    hashtags: string[];
    imagePreviewPath: string;
    inputs: any;
    isSubmitting: boolean;
    selectedImage?: any;
}

const mapStateToProps = (state) => ({
    content: state.content,
    forums: state.forums,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createForum: ForumActions.createForum,
            updateForum: ForumActions.updateForum,
            searchCategories: ForumActions.searchCategories,
        },
        dispatch
    );

class EditChat extends React.Component<IEditChatProps, IEditChatState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeButtons = buildButtonStyles();
    private themeCategory = buildCategoryStyles();
    private themeForms = buildFormStyles();

    static getDerivedStateFromProps(nextProps: IEditChatProps, nextState: IEditChatState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums.forumCategories,
            };
        }

        return null;
    }

    constructor(props) {
        super(props);

        const { content, route } = props;
        const { categories, group, imageDetails } = route.params || {};
        const initialMediaId = group?.mediaIds?.split(',')[0] || undefined;

        this.state = {
            groupId: group?.id,
            categories: (categories || []).map(c => ({ ...c, isActive: false })),
            errorMsg: '',
            successMsg: '',
            toggleChevronName: 'chevron-down',
            hashtags: group?.hashTags ? group?.hashTags?.split(',') : [],
            inputs: {
                isPublic: group?.isPublic == null ? true : group?.isPublic,
                title: group?.title || '',
                subtitle: group?.subtitle || '',
                description: group?.description || '',
                city: group?.city || '',
                region: group?.region || '',
                iconGroup: group?.iconGroup || '',
                iconId: group?.iconId || '',
                iconColor: group?.iconColor || '',
                // integrationIds: group?.integrationIds ? group?.integrationIds.join(',') : '',
                // invitees: group?.invitees ? group?.invitees.join('') : '',
            },
            isSubmitting: false,
            selectedImage: imageDetails || {},
            imagePreviewPath: imageDetails?.path
                ? getImagePreviewPath(imageDetails?.path)
                : (initialMediaId && content?.media[initialMediaId] || ''),
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeAccentLayout = buildAccentStyles(props.user.settings?.mobileThemeName);
        this.themeCategory = buildCategoryStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator(props.user.settings?.locale || 'en-us', key, params);
    }

    componentDidMount() {
        const { forums, navigation, searchCategories, route } = this.props;
        const { group } = route.params || {};

        navigation.setOptions({
            title: group?.id ? this.translate('pages.editChat.headerTitleEdit') : this.translate('pages.editChat.headerTitleCreate'),
        });

        if (forums && (!forums.forumCategories || !forums.forumCategories.length)) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            }, {});
        }
    }

    handleImageSelect = (imageResponse) => {
        if (!imageResponse.didCancel && !imageResponse.errorCode) {
            this.setState({
                selectedImage: imageResponse,
                imagePreviewPath: getImagePreviewPath(imageResponse?.path),
            });
        }
    };

    onAddImage = (action: string) => {
        const { user } = this.props;
        const storePermissions = () => {};

        return requestOSCameraPermissions(storePermissions).then((response) => {
            const permissionsDenied = Object.keys(response).some((key) => {
                return response[key] !== 'granted';
            });
            const pickerOptions: any = {
                mediaType: 'photo',
                includeBase64: false,
                height: 4 * viewportWidth,
                width: 4 * viewportWidth,
                multiple: false,
                cropping: true,
            };
            if (!permissionsDenied) {
                if (action === 'camera') {
                    return ImageCropPicker.openCamera(pickerOptions)
                        .then((cameraResponse) => this.handleImageSelect(cameraResponse));
                } else {
                    return ImageCropPicker.openPicker(pickerOptions)
                        .then((cameraResponse) => this.handleImageSelect(cameraResponse));
                }
            } else {
                logEvent(getAnalytics(), 'permissions_denied_issue', {
                    platform: Platform.OS,
                    userId: user?.details?.id,
                }).catch((err) => console.log(err));
                showToast.error({
                    text1: this.translate('alertTitles.permissionsDenied'),
                    text2: this.translate('alertMessages.cameraOrFilePermissionsDenied'),
                });
                throw new Error('permissions denied');
            }
        }).catch((e) => {
            if (e?.message.toLowerCase().includes('cancel')) {
                console.log('canceled');
            }
        });
    };

    handleHashtagPress = (tag) => {
        const { hashtags } = this.state;
        const modifiedHastags = hashtags.filter(t => t !== tag);

        this.setState({
            hashtags: modifiedHastags,
        });
    };

    isFormDisabled() {
        const { isSubmitting } = this.state;
        const {
            title,
            description,
        } = this.state.inputs;
        const requiredInputs = {
            title,
            description,
        };

        return isSubmitting || Object.keys(requiredInputs).some((key) => !requiredInputs[key]);
    }

    onSubmit = () => {
        const { user } = this.props;
        const { groupId, categories, hashtags, selectedImage } = this.state;
        const {
            administratorIds,
            title,
            subtitle,
            description,
            city,
            region,
            integrationIds,
            invitees,
            iconGroup,
            iconId,
            iconColor,
            maxCommentsPerMin,
            doesExpire,
            isPublic,
        } = this.state.inputs;

        const createArgs: any = {
            administratorIds: [user.details.id, ...(administratorIds || [])].join(','),
            title,
            subtitle: subtitle || title,
            description,
            city: city || undefined,
            region: region || undefined,
            // TODO: Implement end-to-end logic to support updating categoryTags
            categoryTags: categories.filter(c => c.isActive).map(c => c.tag),
            hashTags: hashtags.join(','),
            integrationIds: integrationIds ? integrationIds.join(',') : '',
            invitees: invitees ? invitees.join('') : '',
            iconGroup: iconGroup || 'font-awesome-5',
            iconId: iconId || 'star',
            iconColor: iconColor || 'black',
            maxCommentsPerMin,
            doesExpire,
            isPublic,
        };

        if (!this.isFormDisabled()) {
            this.setState({
                isSubmitting: true,
            });

            // Note do not save image on 'create draft' otherwise we end up with duplicate images when finalizing draft
            // This is not the BEST user experience but prevents a lot of potential waste
            ((selectedImage?.path) ? this.signAndUploadImage(createArgs) : Promise.resolve(createArgs)).then((modifiedCreateArgs) => {
                const createOrUpdatePromise = groupId
                    ? this.props.updateForum(groupId, modifiedCreateArgs)
                    : this.props.createForum(modifiedCreateArgs);

                // TODO: Move success/error alert to group chat page and remove settimeout
                createOrUpdatePromise
                    .then((result) => {
                        showToast.success({
                            text1: this.translate('forms.editGroup.backendSuccessHeader'),
                            text2: this.translate('forms.editGroup.backendSuccessMessage'),
                        });
                        logEvent(getAnalytics(),groupId ? 'group_update' : 'group_create', {
                            userId: user.details.id,
                            isPublic,
                        }).catch((err) => console.log(err));
                        setTimeout(() => {
                            const createdForum = result?.forum || result;
                            if (!groupId && createdForum?.id) {
                                // Navigate to the new group chat so the creator can send a welcome message
                                this.props.navigation.navigate('ViewGroup', {
                                    id: createdForum.id,
                                    title: createdForum.title || title,
                                    subtitle: createdForum.subtitle || subtitle || title,
                                    description: createdForum.description || description,
                                    hashTags: hashtags.join(','),
                                    isNewlyCreated: true,
                                });
                            } else {
                                this.props.navigation.navigate('Groups', {
                                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                                });
                            }
                        }, 200);
                    })
                    .catch((error: any) => {
                        if (
                            error.statusCode === 400 ||
                            error.statusCode === 401 ||
                            error.statusCode === 404
                        ) {
                            let errorMessage = '';
                            if (error.errorCode === ErrorCodes.DuplicatePost) {
                                errorMessage = this.translate('alertTitles.duplicatePost');
                            } else {
                                errorMessage = `${error.message}${
                                    error.parameters
                                        ? '(' + error.parameters.toString() + ')'
                                        : ''
                                }`;
                            }
                            showToast.error({
                                text1: this.translate('alertTitles.backendErrorMessage'),
                                text2: errorMessage,
                            });
                        } else if (error.statusCode >= 500) {
                            showToast.error({
                                text1: this.translate('alertTitles.backendErrorMessage'),
                                text2: this.translate('forms.editGroup.backendErrorMessage'),
                            });
                        }
                    })
                    .finally(() => {
                        this.setState({
                            isSubmitting: false,
                        });
                        Keyboard.dismiss();
                        this.scrollViewRef.scrollToEnd({ animated: true });
                    });
            });
        }
    };

    signAndUploadImage = (createArgs) => {
        const { selectedImage } = this.state;
        const {
            subtitle,
            title,
            isPublic,
        } = this.state.inputs;
        const {
            route,
        } = this.props;
        const {
        } = route.params;
        const imageDetails = selectedImage;
        const filePathSplit = imageDetails?.path?.split('.');
        const fileExtension = filePathSplit ? `${filePathSplit[filePathSplit.length - 1]}` : 'jpeg';

        // TODO: This is too slow
        // Use public method for public spaces
        return signImageUrl(isPublic, {
            action: 'write',
            filename: `${FilePaths.GROUPS}/${(title || subtitle.substring(0, 20)).replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`,
        }).then((response) => {
            const signedUrl = response?.data?.url && response?.data?.url[0];
            createArgs.media = [{}];
            createArgs.media[0].altText = title;
            createArgs.media[0].type = isPublic ? Content.mediaTypes.USER_IMAGE_PUBLIC : Content.mediaTypes.USER_IMAGE_PRIVATE;
            createArgs.media[0].path = response?.data?.path;
            // TODO: Replace media with medias after migrations
            createArgs.medias = createArgs.media;

            const localFileCroppedPath = `${imageDetails?.path}`;

            // Upload to Google Cloud
            // TODO: Abstract and add nudity filter sightengine.com
            return RNFB.fetch(
                'PUT',
                signedUrl,
                {
                    'Content-Type': imageDetails.mime,
                    'Content-Length': imageDetails.size.toString(),
                    'Content-Disposition': 'inline',
                },
                RNFB.wrap(localFileCroppedPath),
            ).then(() => createArgs);
        });
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

    handleCategoryTogglePress = () => {
        const  { toggleChevronName } = this.state;

        this.setState({
            toggleChevronName: toggleChevronName === 'chevron-down' ? 'chevron-up' : 'chevron-down',
        });
    };

    handleCategoryPress = (category) => {
        const { categories } = this.state;
        const modifiedCategories: any = [ ...categories ];

        modifiedCategories.some((c, i) => {
            if (c.tag === category.tag) {
                modifiedCategories[i] = { ...c, isActive: !c.isActive };
                return true;
            }
        });

        this.setState({
            categories: modifiedCategories,
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
    };

    render() {
        const { navigation } = this.props;
        const { categories, hashtags, imagePreviewPath, inputs, toggleChevronName } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollViewFull}
                        keyboardShouldPersistTaps="handled"
                        // contentContainerStyle={[this.theme.styles.bodyScroll, this.themeAccentLayout.styles.bodyEditScroll]}
                    >
                        <GroupCategories
                            style={this.themeAccentLayout.styles.categoriesContainer}
                            backgroundColor={this.theme.colors.accent1}
                            categories={categories}
                            onCategoryPress={this.handleCategoryPress}
                            translate={this.translate}
                            onCategoryTogglePress={this.handleCategoryTogglePress}
                            toggleChevronName={toggleChevronName}
                            theme={this.theme}
                            themeButtons={this.themeButtons}
                            themeCategory={this.themeCategory}
                        />
                        <View style={[this.themeAccentLayout.styles.container, {
                            position: 'relative',
                        }]}>
                            <View style={{
                                marginBottom: 16,
                                borderRadius: 16,
                                backgroundColor: this.theme.colors.accent2,
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                            }}>
                                {
                                    imagePreviewPath
                                        ? (
                                            <Image
                                                source={{ uri: imagePreviewPath }}
                                                style={{
                                                    width: '100%',
                                                    aspectRatio: 16 / 9,
                                                    borderRadius: 16,
                                                }}
                                            />
                                        )
                                        : (
                                            <View style={{
                                                width: '100%',
                                                aspectRatio: 16 / 9,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <TherrIcon
                                                    name="camera"
                                                    size={40}
                                                    style={{ color: this.theme.colors.textGray }}
                                                />
                                                <Text style={{ color: this.theme.colors.textGray, marginTop: 8, fontSize: 14 }}>
                                                    {this.translate('forms.editGroup.labels.addImageNote')}
                                                </Text>
                                            </View>
                                        )
                                }
                            </View>
                            <Button
                                containerStyle={spacingStyles.marginBotMd}
                                buttonStyle={this.themeForms.styles.buttonPrimary}
                                disabledStyle={this.themeForms.styles.buttonRoundDisabled}
                                disabledTitleStyle={this.themeForms.styles.buttonTitleDisabled}
                                titleStyle={this.themeForms.styles.buttonTitle}
                                title={this.translate(
                                    imagePreviewPath ? 'forms.editGroup.buttons.replaceImage' : 'forms.editGroup.buttons.addImage'
                                )}
                                icon={
                                    <TherrIcon
                                        name="camera"
                                        size={23}
                                        style={{ color: this.theme.colors.primary, paddingRight: 8 }}
                                    />
                                }
                                onPress={() => SheetManager.show('image-picker-sheet', {
                                    payload: {
                                        galleryText: this.translate('forms.editGroup.buttons.selectExisting'),
                                        cameraText: this.translate('forms.editGroup.buttons.captureNew'),
                                        themeForms: this.themeForms,
                                        onSelect: (source) => this.onAddImage(source),
                                    },
                                })}
                                raised={false}
                            />
                            {
                                !!imagePreviewPath &&
                                <Button
                                    containerStyle={spacingStyles.marginBotMd}
                                    buttonStyle={this.themeForms.styles.buttonRoundAlt}
                                    titleStyle={this.themeForms.styles.buttonTitleAlt}
                                    title={this.translate('forms.editGroup.buttons.removeImage')}
                                    icon={
                                        <OctIcon
                                            name="x"
                                            size={18}
                                            style={{ color: this.theme.colors.accentRed, paddingRight: 8 }}
                                        />
                                    }
                                    onPress={() => this.setState({ selectedImage: undefined, imagePreviewPath: '' })}
                                    raised={false}
                                />
                            }
                            <InputGroupName
                                autoFocus
                                onChangeText={(text) =>
                                    this.onInputChange('title', text)
                                }
                                themeForms={this.themeForms}
                                translate={this.translate}
                                value={inputs.title}
                            />
                            <RoundInput
                                containerStyle={{ marginTop: 14 }}
                                placeholder={this.translate(
                                    'forms.editGroup.placeholders.subtitle'
                                )}
                                value={inputs.subtitle}
                                onChangeText={(text) =>
                                    this.onInputChange('subtitle', text)
                                }
                                themeForms={this.themeForms}
                            />
                            <View style={{ marginTop: 24 }}>
                                <RoundTextInput
                                    placeholder={this.translate(
                                        'forms.editGroup.placeholders.description'
                                    )}
                                    value={inputs.description}
                                    onChangeText={(text) =>
                                        this.onInputChange('description', text)
                                    }
                                    minHeight={150}
                                    numberOfLines={7}
                                    themeForms={this.themeForms}
                                />
                            </View>
                            <CityAutocompleteInput
                                placeholder={this.translate('forms.editGroup.placeholders.city')}
                                initialValue={inputs.city}
                                onCitySelect={(city, region) => {
                                    this.onInputChange('city', city);
                                    if (region) {
                                        this.onInputChange('region', region);
                                    }
                                }}
                                theme={this.theme}
                                themeForms={this.themeForms}
                                containerStyle={{ marginTop: 14, zIndex: 10 }}
                            />
                            <RoundInput
                                containerStyle={{ marginTop: 14 }}
                                placeholder={this.translate(
                                    'forms.editGroup.placeholders.region'
                                )}
                                value={inputs.region}
                                onChangeText={(text) =>
                                    this.onInputChange('region', text)
                                }
                                themeForms={this.themeForms}
                            />
                            <RoundInput
                                containerStyle={{ marginTop: 14, marginBottom: !hashtags?.length ? 10 : 0 }}
                                autoCorrect={false}
                                errorStyle={this.theme.styles.displayNone}
                                placeholder={this.translate(
                                    'forms.editMoment.labels.hashTags'
                                )}
                                value={inputs.hashTags}
                                onChangeText={(text) =>
                                    this.onInputChange('hashTags', text)
                                }
                                onBlur={this.handleHashTagsBlur}
                                themeForms={this.themeForms}
                            />
                            <HashtagsContainer
                                hashtags={hashtags}
                                onHashtagPress={this.handleHashtagPress}
                                styles={this.themeForms.styles}
                            />
                        </View>
                    </KeyboardAwareScrollView>
                    <EditFormFooter
                        isDarkMode={isDarkTheme(this.props.user.settings?.mobileThemeName)}
                        theme={this.theme}
                        buttons={[
                            {
                                title: this.translate('forms.editGroup.buttons.back'),
                                onPress: () => navigation.navigate('Groups', {
                                    activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                                }),
                                mode: 'outlined',
                                icon: 'arrow-left',
                                textColor: this.theme.colors.brandingBlueGreen,
                            },
                            {
                                title: this.translate('forms.editGroup.buttons.submit'),
                                onPress: this.onSubmit,
                                mode: 'contained',
                                icon: 'send',
                                disabled: this.isFormDisabled(),
                                loading: this.state.isSubmitting,
                                buttonColor: this.theme.colors.accentTeal,
                                textColor: this.theme.colors.brandingBlack,
                            },
                        ]}
                    />
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditChat);
