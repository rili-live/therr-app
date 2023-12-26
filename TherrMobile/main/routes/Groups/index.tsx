import React from 'react';
import { Text, FlatList, SafeAreaView, View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { ForumActions } from 'therr-react/redux/actions';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IForumsState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import HostedChatButtonMenu from '../../components/ButtonMenu/HostedChatButtonMenu';
import translator from '../../services/translator';
import RoundInput from '../../components/Input/Round';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildFormsStyles } from '../../styles/forms';
import { buildStyles as buildCategoryStyles } from '../../styles/user-content/groups/categories';
import { buildStyles as buildChatStyles } from '../../styles/user-content/groups';
import { buildStyles as buildTileStyles } from '../../styles/user-content/groups/chat-tiles';
import GroupCategories from './GroupCategories';
import BaseStatusBar from '../../components/BaseStatusBar';
import GroupTile from './GroupTile';

const chatKeyExtractor = (item) => item.id.toString();

interface IGroupsDispatchProps {
    searchCategories: Function;
    searchForums: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IGroupsDispatchProps {
    forums: IForumsState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IGroupsProps extends IStoreProps {
    navigation: any;
}

interface IGroupsState {
    categories: any[];
    searchFilters: any;
    searchInput: string;
    toggleChevronName: 'chevron-down' | 'chevron-up',
}

const mapStateToProps = (state) => ({
    forums: state.forums,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchCategories: ForumActions.searchCategories,
            searchForums: ForumActions.searchForums,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class Groups extends React.Component<IGroupsProps, IGroupsState> {
    private flatListRef: any;
    private translate: Function;
    private searchTimerId: any;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeForms = buildFormsStyles();
    private themeCategory = buildCategoryStyles();
    private themeChat = buildChatStyles();
    private themeTile = buildTileStyles();

    static getDerivedStateFromProps(nextProps: IGroupsProps, nextState: IGroupsState) {
        if (!nextState.categories || !nextState.categories.length) {
            return {
                categories: nextProps.forums.forumCategories,
            };
        }

        return null;
    }

    constructor(props) {
        super(props);

        this.state = {
            categories: props.categories || [],
            searchFilters: {
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            },
            searchInput: '',
            toggleChevronName: 'chevron-down',
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeCategory = buildCategoryStyles(props.user.settings?.mobileThemeName);
        this.themeChat = buildChatStyles(props.user.settings?.mobileThemeName);
        this.themeTile = buildTileStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { forums, navigation, searchCategories, searchForums } = this.props;
        const { searchFilters } = this.state;

        navigation.setOptions({
            title: this.translate('pages.groups.headerTitle'),
        });

        if (forums && (!forums.searchResults || !forums.searchResults.length)) {
            searchForums(searchFilters, {});
        }

        if (forums && (!forums.forumCategories || !forums.forumCategories.length)) {
            searchCategories({
                itemsPerPage: 100,
                pageNumber: 1,
                order: 'desc',
            }, {});
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.searchTimerId);
    };

    handleCategoryPress = (category) => {
        const { categories, searchInput } = this.state;
        const modifiedCategories: any = [ ...categories ];

        modifiedCategories.some((c, i) => {
            if (c.tag === category.tag) {
                modifiedCategories[i] = { ...c, isActive: !c.isActive };
                return true;
            }
        });

        this.searchForumsWithFilters(searchInput, modifiedCategories);

        this.setState({
            categories: modifiedCategories,
        });
    };

    handleChatTilePress = (chat) => {
        const { navigation } = this.props;

        navigation.navigate('ViewChat', chat);
    };

    handleCategoryTogglePress = () => {
        const  { toggleChevronName } = this.state;
        this.setState({
            toggleChevronName: toggleChevronName === 'chevron-down' ? 'chevron-up' : 'chevron-down',
        });
    };

    handleCreateGroup = () => {
        const { forums, navigation } = this.props;
        const categories = (forums && forums.forumCategories) || [];

        navigation.navigate('EditChat', { categories });
    };

    onSearchInputChange = (text) => {
        this.searchForumsWithFilters(text);

        this.setState({
            searchInput: text,
        });
    };

    searchForumsWithFilters = (text, modifiedCategories?) => {
        const { searchForums } = this.props;
        const { categories, searchFilters } = this.state;

        clearTimeout(this.searchTimerId);

        this.searchTimerId = setTimeout(() => {
            const selectedCategoryTags = (modifiedCategories || categories).filter(c => c.isActive).map(c => c.tag);
            const searchParams = {
                ...searchFilters,
                query: text,
                filterBy: 'title',
                filterOperator: 'ilike',
            };
            const searchArgs: any = {};
            if (selectedCategoryTags.length) {
                searchArgs.categoryTags = selectedCategoryTags;
            }
            searchForums(searchParams, searchArgs);
        }, 250);
    };

    render() {
        const { forums } = this.props;
        const { categories, toggleChevronName } = this.state;
        const forumSearchResults = (forums && forums.searchResults) || [];

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <View style={this.themeChat.styles.searchContainer}>
                        <RoundInput
                            autoCapitalize="none"
                            containerStyle={this.themeChat.styles.searchInputContainer}
                            placeholder={this.translate(
                                'forms.groups.searchPlaceholder'
                            )}
                            value={this.state.searchInput}
                            onChangeText={this.onSearchInputChange}
                            rightIcon={
                                <FontAwesomeIcon
                                    name="search"
                                    color={this.theme.colors.primary3}
                                    style={this.themeChat.styles.searchIcon}
                                    size={22}
                                />
                            }
                            errorStyle={this.themeChat.styles.searchInputError}
                            themeForms={this.themeForms}
                        />
                    </View>
                    <GroupCategories
                        style={{}}
                        backgroundColor={this.theme.colors.primary}
                        categories={categories}
                        onCategoryPress={this.handleCategoryPress}
                        translate={this.translate}
                        onCategoryTogglePress={this.handleCategoryTogglePress}
                        toggleChevronName={toggleChevronName}
                        theme={this.theme}
                        themeForms={this.themeForms}
                        themeCategory={this.themeCategory}
                    />

                    {
                        !forumSearchResults.length ?
                            <Text style={this.themeChat.styles.noResultsText}>{this.translate('forms.groups.noResultsFound')}</Text> :
                            <FlatList
                                horizontal={false}
                                keyExtractor={chatKeyExtractor}
                                data={forumSearchResults}
                                renderItem={({
                                    item: group,
                                }) =>
                                    <GroupTile
                                        group={group}
                                        onChatTilePress={this.handleChatTilePress}
                                        theme={this.theme}
                                        themeChatTile={this.themeTile}
                                        isActive={false}
                                    />
                                }
                                style={this.theme.styles.scrollViewFull}
                                contentContainerStyle={this.themeChat.styles.scrollContentContainer}
                                ref={(component) => (this.flatListRef = component)}
                                initialScrollIndex={0}
                                onContentSizeChange={forumSearchResults.length ? () => this.flatListRef.scrollToIndex({
                                    index: 0,
                                    animated: true,
                                }) : undefined}
                            />
                    }
                    <View style={this.themeChat.styles.createChatBtnContainer}>
                        <Button
                            buttonStyle={this.themeButtons.styles.btn}
                            icon={
                                <FontAwesomeIcon
                                    name="marker"
                                    size={44}
                                    style={this.themeButtons.styles.btnIcon}
                                />
                            }
                            raised={true}
                            onPress={this.handleCreateGroup}
                        />
                    </View>
                </SafeAreaView>
                {/* <HostedChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Groups);
