import React from 'react';
import { FlatList, SafeAreaView, StatusBar, View } from 'react-native';
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
import hostedChatStyles from '../../styles/hosted-chat';
import ChatCategories from './ChatCategories';
import renderChatTile from './ChatTile';

const chatKeyExtractor = (item) => item.id.toString();

let categories: any[] = [
    {
        name: 'music',
        tag: 'music',
        iconColor: '#143b54',
        iconId: 'music',
        iconGroup: 'font-awesome-5',
    },
    {
        name: 'movies',
        tag: 'movies',
        iconColor: '#ebc300',
        iconId: 'video',
        iconGroup: 'font-awesome-5',
    },
    {
        name: 'science',
        tag: 'science',
        iconColor: '#388254',
        iconId: 'biotech',
        iconGroup: 'therr',
    },
    {
        name: 'tech',
        tag: 'tech',
        iconColor: '#f9ad2a',
        iconId: 'rocket',
        iconGroup: 'therr',
    },
    {
        name: 'sports',
        tag: 'sports',
        iconColor: '#363636',
        iconId: 'futbol',
        iconGroup: 'font-awesome-5',
    },
];

const hostedChats: any[] = [
    {
        id: 1,
        authorId: 7,
        authorLocale: 'en-us',
        title: 'A Basic Hosted Chat With a Really Long Title',
        subtitle: 'This is sample content for demo',
        description: 'This chat is about general topics This chat is about general topics This chat is about general topics This chat is about general topics This chat is about general topics', // eslint-disable-line max-len
        administratorIds: '7',
        integrationIds: '',
        invitees: '7,8,9',
        iconGroup: 'therr',
        iconId: 'rocket',
        iconColor: '#f9ad2a',
        maxCommentsPerMin: 5,
        doesExpire: false,
        isPublic: true,
        createdAt: '2021-02-15T15:37:23.899Z',
        updatedAt: '2021-02-15T15:57:23.899Z',
        categories: [categories[3], categories[1]],
    },
    {
        id: 2,
        authorId: 8,
        authorLocale: 'en-us',
        title: 'Another Basic Hosted Chat',
        subtitle: 'This is more sample content for demo',
        description: 'This chat is about sports',
        administratorIds: '8',
        integrationIds: '',
        invitees: '7,8,9',
        iconGroup: 'font-awesome-5',
        iconId: 'futbol',
        iconColor: '#363636',
        maxCommentsPerMin: 5,
        doesExpire: false,
        isPublic: false,
        createdAt: '2021-02-15T15:17:23.899Z',
        updatedAt: '2021-02-15T15:17:23.899Z',
        categories: [categories[4]],
    },
    {
        id: 3,
        authorId: 9,
        authorLocale: 'en-us',
        title: 'A Basic Hosted Chat',
        subtitle: 'This is sample content for demo',
        description: 'This chat is about general topics',
        administratorIds: '7',
        integrationIds: '',
        invitees: '7,8,9',
        iconGroup: 'therr',
        iconId: 'rocket',
        iconColor: '#f9ad2a',
        maxCommentsPerMin: 5,
        doesExpire: false,
        isPublic: true,
        createdAt: '2021-02-15T15:37:23.899Z',
        updatedAt: '2021-02-15T15:57:23.899Z',
        categories: [categories[3], categories[1]],
    },
    {
        id: 4,
        authorId: 8,
        authorLocale: 'en-us',
        title: 'Another Basic Hosted Chat',
        subtitle: 'This is more sample content for demo',
        description: 'This chat is about sports',
        administratorIds: '8',
        integrationIds: '',
        invitees: '7,8,9',
        iconGroup: 'font-awesome-5',
        iconId: 'futbol',
        iconColor: '#363636',
        maxCommentsPerMin: 5,
        doesExpire: false,
        isPublic: false,
        createdAt: '2021-02-15T15:17:23.899Z',
        updatedAt: '2021-02-15T15:17:23.899Z',
        categories: [categories[4]],
    },
];

interface IHostedChatDispatchProps {
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
    categories: any,
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
            searchForums: ForumActions.searchForums,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class HostedChat extends React.Component<IHostedChatProps, IHostedChatState> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            categories,
            searchInput: '',
            toggleChevronName: 'chevron-down',
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { forums, navigation, searchForums } = this.props;

        navigation.setOptions({
            title: this.translate('pages.hostedChat.headerTitle'),
        });

        // TODO: Fetch available rooms on first load
        if (forums && (!forums.searchResults || !forums.searchResults.length)) {
            searchForums({
                itemsPerPage: 20,
                pageNumber: 1,
                order: 'desc',
            }, {});
        }
    }

    handleCategoryPress = (category) => {
        categories.some((cat: any, i) => {
            if (cat.tag === category.tag) {
                categories[i].isActive = !cat.isActive;
                return true;
            }
        });

        this.setState({
            categories,
        });
    }

    handleChatTilePress = (chat) => {
        console.log(chat);
        const { navigation } = this.props;

        navigation.navigate('ViewChat', chat);
    }

    handleCategoryTogglePress = () => {
        const  { toggleChevronName } = this.state;
        console.log('Toggle', toggleChevronName === 'chevron-down' ? 'chevron-up' : 'chevron-down');
        this.setState({
            toggleChevronName: toggleChevronName === 'chevron-down' ? 'chevron-up' : 'chevron-down',
        });
    }

    handleCreateHostedChat = () => {
        const { navigation } = this.props;

        navigation.navigate('EditChat');
    };

    onSearchInputChange = (text) => {
        this.setState({
            searchInput: text,
        });
    }

    render() {
        // const { navigation, user } = this.props;
        const { categories, toggleChevronName } = this.state;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
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
                        categories={categories}
                        onCategoryPress={this.handleCategoryPress}
                        translate={this.translate}
                        onCategoryTogglePress={this.handleCategoryTogglePress}
                        toggleChevronName={toggleChevronName}
                    />
                    <FlatList
                        horizontal={false}
                        keyExtractor={chatKeyExtractor}
                        data={hostedChats}
                        renderItem={renderChatTile(this.handleChatTilePress)}
                        style={styles.scrollViewFull}
                        contentContainerStyle={hostedChatStyles.scrollContentContainer}
                    />
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
