import React from 'react';
import { Keyboard, SafeAreaView, StatusBar, View } from 'react-native';
import { Button } from 'react-native-elements';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { ForumActions } from 'therr-react/redux/actions';
import { IUserState } from 'therr-react/types';
import translator from '../../services/translator';
import styles from '../../styles';
import * as therrTheme from '../../styles/themes';
import beemoLayoutStyles from '../../styles/layouts/beemo';
import { beemoEditForm as beemoFormStyles } from '../../styles/forms';
import formatHashtags from '../../utilities/formatHashtags';
import BeemoInput from '../../components/Input/Beemo';
import BeemoTextInput from '../../components/TextInput/Beemo';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';
import ChatCategories from './ChatCategories';

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

    constructor(props) {
        super(props);

        const { route } = props;
        const { categories } = route.params;

        this.state = {
            categories: categories.map(c => ({ ...c, isActive: false })),
            errorMsg: '',
            successMsg: '',
            toggleChevronName: 'chevron-down',
            hashtags: [],
            inputs: {},
            isSubmitting: false,
        };

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
    }

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
            // TODO: Move success/error alert to hosted chat page andd remove settimeout
            this.props
                .createHostedChat(createArgs)
                .then(() => {
                    this.setState({
                        successMsg: this.translate('forms.editHostedChat.backendSuccessMessage'),
                    });
                    setTimeout(() => {
                        this.props.navigation.navigate('HostedChat');
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
                            errorMsg: this.translate('forms.editHostedChat.backendErrorMessage'),
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
    }

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
    }

    render() {
        const { navigation } = this.props;
        const { categories, hashtags, inputs, toggleChevronName } = this.state;

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
                        <ChatCategories
                            style={beemoLayoutStyles.categoriesContainer}
                            backgroundColor={therrTheme.colors.beemo1}
                            categories={categories}
                            onCategoryPress={this.handleCategoryPress}
                            translate={this.translate}
                            onCategoryTogglePress={this.handleCategoryTogglePress}
                            toggleChevronName={toggleChevronName}
                        />
                        <View style={beemoLayoutStyles.container}>
                            <BeemoInput
                                placeholder={this.translate(
                                    'forms.editHostedChat.placeholders.title'
                                )}
                                value={inputs.title}
                                onChangeText={(text) =>
                                    this.onInputChange('title', text)
                                }
                            />
                            <BeemoInput
                                placeholder={this.translate(
                                    'forms.editHostedChat.placeholders.subtitle'
                                )}
                                value={inputs.subtitle}
                                onChangeText={(text) =>
                                    this.onInputChange('subtitle', text)
                                }
                            />
                            <BeemoInput
                                autoCorrect={false}
                                errorStyle={styles.displayNone}
                                placeholder={this.translate(
                                    'forms.editHostedChat.placeholders.hashTags'
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
                            <BeemoTextInput
                                placeholder={this.translate(
                                    'forms.editHostedChat.placeholders.description'
                                )}
                                value={inputs.description}
                                onChangeText={(text) =>
                                    this.onInputChange('description', text)
                                }
                                numberOfLines={3}
                            />
                        </View>
                    </KeyboardAwareScrollView>
                    <View style={beemoLayoutStyles.footer}>
                        <Button
                            containerStyle={beemoFormStyles.backButtonContainer}
                            buttonStyle={beemoFormStyles.backButton}
                            onPress={() => navigation.navigate('HostedChat')}
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
                            buttonStyle={beemoFormStyles.submitButton}
                            disabledStyle={beemoFormStyles.submitButtonDisabled}
                            disabledTitleStyle={beemoFormStyles.submitDisabledButtonTitle}
                            titleStyle={beemoFormStyles.submitButtonTitle}
                            containerStyle={beemoFormStyles.submitButtonContainer}
                            title={this.translate(
                                'forms.editMoment.buttons.submit'
                            )}
                            icon={
                                <FontAwesome5Icon
                                    name="paper-plane"
                                    size={25}
                                    color={this.isFormDisabled() ? 'grey' : 'black'}
                                    style={beemoFormStyles.submitButtonIcon}
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
