import React from 'react';
import { Keyboard, SafeAreaView, View } from 'react-native';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import RNFB from 'react-native-blob-util';
import Toast from 'react-native-toast-message';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import analytics from '@react-native-firebase/analytics';
import { ForumActions } from 'therr-react/redux/actions';
import { Content, FilePaths } from 'therr-js-utilities/constants';
import { IContentState, IForumsState, IUserState } from 'therr-react/types';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildCategoryStyles } from '../../styles/user-content/groups/categories';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildAccentFormStyles } from '../../styles/forms/accentEditForm';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import formatHashtags from '../../utilities/formatHashtags';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import GroupCategories from './GroupCategories';
import BaseStatusBar from '../../components/BaseStatusBar';
import TherrIcon from '../../components/TherrIcon';
import RoundInput from '../../components/Input/Round';
import RoundTextInput from '../../components/Input/TextInput/Round';
import { GROUPS_CAROUSEL_TABS } from '../../constants';
import InputGroupName from './InputGroupName';
import { getImagePreviewPath } from '../../utilities/areaUtils';
import { signImageUrl } from '../../utilities/content';

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
    private themeAccentForms = buildAccentFormStyles();
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
        this.themeAccentForms = buildAccentFormStyles(props.user.settings?.mobileThemeName);
        this.themeCategory = buildCategoryStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
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
            // TODO: Implement end-to-end logic to support updating categoryTags
            categoryTags: categories.filter(c => c.isActive).map(c => c.tag) || ['general'],
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
                    .then(() => {
                        Toast.show({
                            type: 'successBig',
                            text1: this.translate('forms.editGroup.backendSuccessHeader'),
                            text2: this.translate('forms.editGroup.backendSuccessMessage'),
                            visibilityTime: 2500,
                        });
                        analytics().logEvent(groupId ? 'group_update' : 'group_create', {
                            userId: user.details.id,
                            isPublic,
                        }).catch((err) => console.log(err));
                        setTimeout(() => {
                            this.props.navigation.navigate('Groups', {
                                activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                            });
                        }, 200);
                    })
                    .catch((error: any) => {
                        if (
                            error.statusCode === 400 ||
                            error.statusCode === 401 ||
                            error.statusCode === 404
                        ) {
                            const errorMessage = `${error.message}${
                                error.parameters
                                    ? '(' + error.parameters.toString() + ')'
                                    : ''
                            }`;
                            Toast.show({
                                type: 'errorBig',
                                text1: this.translate('alertTitles.backendErrorMessage'),
                                text2: errorMessage,
                            });
                        } else if (error.statusCode >= 500) {
                            Toast.show({
                                type: 'errorBig',
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
        const { categories, hashtags, inputs, toggleChevronName } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        ref={(component) => (this.scrollViewRef = component)}
                        style={this.theme.styles.scrollView}
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
                                placeholder={this.translate(
                                    'forms.editGroup.placeholders.subtitle'
                                )}
                                value={inputs.subtitle}
                                onChangeText={(text) =>
                                    this.onInputChange('subtitle', text)
                                }
                                themeForms={this.themeForms}
                            />
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
                            <RoundInput
                                containerStyle={{ marginBottom: !hashtags?.length ? 10 : 0 }}
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
                    <View style={this.themeAccentLayout.styles.footer}>
                        <Button
                            containerStyle={this.themeAccentForms.styles.backButtonContainer}
                            buttonStyle={this.themeAccentForms.styles.backButton}
                            onPress={() => navigation.navigate('Groups', {
                                activeTab: GROUPS_CAROUSEL_TABS.GROUPS,
                            })}
                            icon={
                                <TherrIcon
                                    name="go-back"
                                    size={25}
                                    color={'black'}
                                />
                            }
                            type="clear"
                        />
                        <Button
                            buttonStyle={this.themeAccentForms.styles.submitButton}
                            disabledStyle={this.themeAccentForms.styles.submitButtonDisabled}
                            disabledTitleStyle={this.themeAccentForms.styles.submitDisabledButtonTitle}
                            titleStyle={this.themeAccentForms.styles.submitButtonTitle}
                            containerStyle={this.themeAccentForms.styles.submitButtonContainer}
                            title={this.translate(
                                'forms.editMoment.buttons.submit'
                            )}
                            icon={
                                <FontAwesome5Icon
                                    name="paper-plane"
                                    size={25}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={this.themeAccentForms.styles.submitButtonIcon}
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

export default connect(mapStateToProps, mapDispatchToProps)(EditChat);
