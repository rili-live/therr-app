import React from 'react';
import { Text, FlatList, SafeAreaView, StatusBar, View } from 'react-native';
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
import * as therrTheme from '../../styles/themes';
import styles from '../../styles';
import buttonStyles from '../../styles/buttons';
import hostedChatStyles from '../../styles/user-content/hosted-chat';
import ChatCategories from './ChatCategories';
import renderChatTile from './ChatTile';

const chatKeyExtractor = (item) => item.id.toString();

interface IHostedChatDispatchProps {
    searchCategories: Function;
    searchForums: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IHostedChatDispatchProps {
    forums: IForumsState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IHostedChatProps extends IStoreProps {
    navigation: any;
}

interface IHostedChatState {
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

class HostedChat extends React.Component<IHostedChatProps, IHostedChatState> {
    private flatListRef: any;
    private translate: Function;
    private searchTimerId: any;

    static getDerivedStateFromProps(nextProps: IHostedChatProps, nextState: IHostedChatState) {
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

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { forums, navigation, searchCategories, searchForums } = this.props;
        const { searchFilters } = this.state;

        navigation.setOptions({
            title: this.translate('pages.hostedChat.headerTitle'),
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
    }

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
    }

    handleChatTilePress = (chat) => {
        const { navigation } = this.props;

        navigation.navigate('ViewChat', chat);
    }

    handleCategoryTogglePress = () => {
        const  { toggleChevronName } = this.state;
        this.setState({
            toggleChevronName: toggleChevronName === 'chevron-down' ? 'chevron-up' : 'chevron-down',
        });
    }

    handleCreateHostedChat = () => {
        const { forums, navigation } = this.props;
        const categories = (forums && forums.forumCategories) || [];

        navigation.navigate('EditChat', { categories });
    };

    onSearchInputChange = (text) => {
        this.searchForumsWithFilters(text);

        this.setState({
            searchInput: text,
        });
    }

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
    }

    render() {
        const { forums } = this.props;
        const { categories, toggleChevronName } = this.state;
        const forumSearchResults = (forums && forums.searchResults) || [];

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView style={styles.safeAreaView}>
                    <View style={hostedChatStyles.searchContainer}>
                        <RoundInput
                            autoCapitalize="none"
                            containerStyle={hostedChatStyles.searchInputContainer}
                            placeholder={this.translate(
                                'forms.hostedChat.searchPlaceholder'
                            )}
                            value={this.state.searchInput}
                            onChangeText={this.onSearchInputChange}
                            rightIcon={
                                <FontAwesomeIcon
                                    name="search"
                                    color={therrTheme.colors.primary3}
                                    style={hostedChatStyles.searchIcon}
                                    size={22}
                                />
                            }
                            errorStyle={hostedChatStyles.searchInputError}
                        />
                    </View>
                    <ChatCategories
                        style={{}}
                        backgroundColor={therrTheme.colors.primary2}
                        categories={categories}
                        onCategoryPress={this.handleCategoryPress}
                        translate={this.translate}
                        onCategoryTogglePress={this.handleCategoryTogglePress}
                        toggleChevronName={toggleChevronName}
                    />

                    {
                        !forumSearchResults.length
                            ? <Text style={hostedChatStyles.noResultsText}>{this.translate('forms.hostedChat.noResultsFound')}</Text>
                            : <FlatList
                                horizontal={false}
                                keyExtractor={chatKeyExtractor}
                                data={forumSearchResults}
                                renderItem={renderChatTile(this.handleChatTilePress)}
                                style={styles.scrollViewFull}
                                contentContainerStyle={hostedChatStyles.scrollContentContainer}
                                ref={(component) => (this.flatListRef = component)}
                                initialScrollIndex={0}
                                onContentSizeChange={forumSearchResults.length ? () => this.flatListRef.scrollToIndex({
                                    index: 0,
                                    animated: true,
                                }) : undefined}
                            />
                    }
                    <View style={hostedChatStyles.createChatBtnContainer}>
                        <Button
                            buttonStyle={buttonStyles.btn}
                            icon={
                                <FontAwesomeIcon
                                    name="marker"
                                    size={44}
                                    style={buttonStyles.btnIcon}
                                />
                            }
                            raised={true}
                            onPress={this.handleCreateHostedChat}
                        />
                    </View>
                </SafeAreaView>
                {/* <HostedChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HostedChat);
