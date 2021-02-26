import React from 'react';
import { FlatList, SafeAreaView, Text, StatusBar, View } from 'react-native';
import { Button } from 'react-native-elements';
// import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { SocketActions, UserConnectionsActions } from 'therr-react/redux/actions';
import { IMesssageState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import ViewChatButtonMenu from '../../components/ButtonMenu/ViewChatButtonMenu';
import translator from '../../services/translator';
// import RoundInput from '../../components/Input/Round';
// import * as therrTheme from '../../styles/themes';
import beemoLayoutStyles from '../../styles/layouts/beemo';
import styles from '../../styles';
import viewChatStyles from '../../styles/hosted-chat/view-chat';
import { beemoEditForm as beemoFormStyles } from '../../styles/forms';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';

interface IViewChatDispatchProps {
    joinForum: Function;
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IViewChatDispatchProps {
    messages: IMesssageState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IViewChatProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IViewChatState {
}

const mapStateToProps = (state) => ({
    messages: state.messages,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            joinForum: SocketActions.joinForum,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class ViewChat extends React.Component<IViewChatProps, IViewChatState> {
    private hashtags;
    private flatListRef;
    private scrollViewRef;
    private translate: Function;

    constructor(props) {
        super(props);

        const { hashTags } = props.route.params;
        this.hashtags = hashTags ? hashTags.split(',') : [];

        this.state = {
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { joinForum, navigation, route, user } = this.props;
        const { title, id: forumId } = route.params;

        navigation.setOptions({
            title,
        });

        joinForum({
            roomId: forumId,
            roomName: title,
            userName: user.details.userName,
        });
    }

    render() {
        const { messages, navigation, route } = this.props;
        const { description, subtitle, id: forumId } = route.params;
        const mgs = messages.forumMsgs[forumId] || [];

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView style={styles.safeAreaView}>
                    <View
                        style={[styles.bodyFlex, beemoLayoutStyles.bodyEdit]}
                    >
                        <View style={beemoLayoutStyles.containerHeader}>
                            <Text>{subtitle}</Text>
                            <Text>{description}</Text>
                            <HashtagsContainer
                                hasIcon={false}
                                hashtags={this.hashtags}
                                onHashtagPress={() => {}}
                            />
                        </View>
                        <View style={[beemoLayoutStyles.container, viewChatStyles.container]}>
                            <FlatList
                                data={mgs}
                                keyExtractor={(item) => String(item.key)}
                                renderItem={({ item }) => (
                                    <Text>{JSON.stringify(item)}</Text>
                                )}
                                ref={(component) => (this.flatListRef = component)}
                                style={styles.stretch}
                                onContentSizeChange={() => mgs.length && this.flatListRef.scrollToEnd({ animated: true })}
                            />
                        </View>
                    </View>
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
                    </View>
                </SafeAreaView>
                {/* <ViewChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewChat);
