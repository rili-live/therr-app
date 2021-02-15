import React from 'react';
import { SafeAreaView, Text, StatusBar, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
// import HostedChatButtonMenu from '../../components/ButtonMenu/HostedChatButtonMenu';
import translator from '../../services/translator';
import RoundInput from '../../components/Input/Round';
import * as therrTheme from '../../styles/themes';
import styles from '../../styles';
import buttonStyles from '../../styles/buttons';
import hostedChatStyles from '../../styles/hosted-chat';
import ChatCategories from './ChatCategories';

let categories: any[] = [
    {
        name: 'music',
        tag: 'music',
        iconColor: 'blue',
        iconId: 'music',
        iconGroup: 'font-awesome-5',
    },
    {
        name: 'movies',
        tag: 'movies',
        iconColor: 'yellow',
        iconId: 'video',
        iconGroup: 'font-awesome-5',
    },
    {
        name: 'science',
        tag: 'science',
        iconColor: 'green',
        iconId: 'biotech',
        iconGroup: 'therr',
    },
    {
        name: 'tech',
        tag: 'tech',
        iconColor: 'orange',
        iconId: 'rocket',
        iconGroup: 'therr',
    },
    {
        name: 'sports',
        tag: 'sports',
        iconColor: 'black',
        iconId: 'futbol',
        iconGroup: 'font-awesome-5',
    },
];

interface IHostedChatDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IHostedChatDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IHostedChatProps extends IStoreProps {
    navigation: any;
}

interface IHostedChatState {
    searchInput: string;
    toggleChevronName: 'chevron-down' | 'chevron-up',
}

const mapStateToProps = (state) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class HostedChat extends React.Component<IHostedChatProps, IHostedChatState> {
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            searchInput: '',
            toggleChevronName: 'chevron-down',
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.hostedChat.headerTitle'),
        });

        // TODO: Fetch available rooms on first load
    }

    handleCategoryPress = (category) => {
        categories.some((cat: any, i) => {
            if (cat.tag === category.tag) {
                categories[i].isActive = !cat.isActive;
                return true;
            }
        });
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

    onSearchInputChange(text) {
        console.log();
        this.setState({
            searchInput: text,
        });
    }

    render() {
        // const { navigation, user } = this.props;
        const { toggleChevronName } = this.state;

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
                    <KeyboardAwareScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollView}
                        contentContainerStyle={hostedChatStyles.scrollContentContainer}
                    >
                        <Text>Placeholder...</Text>
                    </KeyboardAwareScrollView>
                    {/* Filterable list of hosted chats (category headers) */}
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
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HostedChat);
