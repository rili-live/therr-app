import React from 'react';
import { Keyboard, SafeAreaView, View } from 'react-native';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { ForumActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildCategoryStyles } from '../../styles/user-content/groups/categories';
import { buildStyles as buildAccentStyles } from '../../styles/layouts/accent';
import { buildStyles as buildAccentFormStyles } from '../../styles/forms/accentEditForm';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import formatHashtags from '../../utilities/formatHashtags';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import GroupCategories from './GroupCategories';
import BaseStatusBar from '../../components/BaseStatusBar';
import TherrIcon from '../../components/TherrIcon';
import RoundInput from '../../components/Input/Round';
import RoundTextInput from '../../components/Input/TextInput/Round';
import { PEOPLE_CAROUSEL_TABS } from '../../constants';

interface IEditChatDispatchProps {
    logout: Function;
    createHostedChat: Function;
}

interface IStoreProps extends IEditChatDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IEditChatProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IEditChatState {
    categories: any[];
    errorMsg: string;
    successMsg: string;
    toggleChevronName: string;
    hashtags: string[];
    inputs: any;
    isSubmitting: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createHostedChat: ForumActions.createForum,
        },
        dispatch
    );

class EditChat extends React.Component<IEditChatProps, IEditChatState> {
    private scrollViewRef;
    private translate: Function;
    private theme = buildStyles();
    private themeAccentLayout = buildAccentStyles();
    private themeAccentForms = buildAccentFormStyles();
    private themeCategory = buildCategoryStyles();
    private themeForms = buildFormStyles();

    constructor(props) {
        super(props);

        const { route } = props;
        const { categories } = route.params || {};

        this.state = {
            categories: (categories || []).map(c => ({ ...c, isActive: false })),
            errorMsg: '',
            successMsg: '',
            toggleChevronName: 'chevron-down',
            hashtags: [],
            inputs: {},
            isSubmitting: false,
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
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.editChat.headerTitleCreate'),
        });
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
        const { categories, hashtags } = this.state;
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
            // TODO: Move success/error alert to group chat page and remove settimeout
            this.props
                .createHostedChat(createArgs)
                .then(() => {
                    this.setState({
                        successMsg: this.translate('forms.editGroup.backendSuccessMessage'),
                    });
                    setTimeout(() => {
                        this.props.navigation.navigate('Contacts', {
                            activeTab: PEOPLE_CAROUSEL_TABS.GROUPS,
                        });
                    }, 200);
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
                            errorMsg: this.translate('forms.editGroup.backendErrorMessage'),
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
                        style={[this.theme.styles.bodyFlex, this.themeAccentLayout.styles.bodyEdit]}
                        contentContainerStyle={[this.theme.styles.bodyScroll, this.themeAccentLayout.styles.bodyEditScroll]}
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
                            themeCategory={this.themeCategory}
                            themeForms={this.themeForms}
                        />
                        <View style={[this.themeAccentLayout.styles.container, {
                            position: 'relative',
                        }]}>
                            <RoundInput
                                autoFocus
                                maxLength={100}
                                placeholder={this.translate(
                                    'forms.editGroup.placeholders.title'
                                )}
                                value={inputs.title}
                                onChangeText={(text) =>
                                    this.onInputChange('title', text)
                                }
                                themeForms={this.themeForms}
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
                                autoCorrect={false}
                                errorStyle={this.theme.styles.displayNone}
                                placeholder={this.translate(
                                    'forms.editGroup.placeholders.hashTags'
                                )}
                                value={inputs.hashTags}
                                onChangeText={(text) =>
                                    this.onInputChange('hashTags', text)
                                }
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
                            onPress={() => navigation.navigate('Contacts', {
                                activeTab: PEOPLE_CAROUSEL_TABS.GROUPS,
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
