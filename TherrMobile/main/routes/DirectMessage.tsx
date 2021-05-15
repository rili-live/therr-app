import React from 'react';
import { SafeAreaView, ActivityIndicator, FlatList, View, Text, StatusBar } from 'react-native';
import { Button, Image } from 'react-native-elements';
import 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MessageActions, SocketActions } from 'therr-react/redux/actions';
import { IUserState, IMessagesState } from 'therr-react/types';
import styles from '../styles';
import messageStyles from '../styles/messages';
import translator from '../services/translator';
import TextMessage from '../components/TextMessage';
import RoundInput from '../components/Input/Round';

interface IDirectMessageDispatchProps {
    searchDms: Function;
    sendDirectMessage: Function;
}

interface IStoreProps extends IDirectMessageDispatchProps {
    messages?: IMessagesState;
    user: IUserState;
}

// Regular component props
export interface IDirectMessageProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IDirectMessageState {
    msgInputVal: string;
    msgScrollPosition: number;
}

const mapStateToProps = (state: any) => ({
    messages: state.messages,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchDms: MessageActions.searchDMs,
            sendDirectMessage: SocketActions.sendDirectMessage,
        },
        dispatch
    );

class DirectMessage extends React.Component<
    IDirectMessageProps,
    IDirectMessageState
> {
    private flatListRef: any;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            msgInputVal: '',
            msgScrollPosition: 0,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { messages, navigation, route, searchDms } = this.props;
        const { connectionDetails } = route.params;

        navigation.setOptions({
            title: connectionDetails.userName,
        });

        if (connectionDetails && !messages.dms || !messages.dms[connectionDetails.id]) {
            searchDms(
                {
                    filterBy: 'fromUserId',
                    query: connectionDetails.id,
                    itemsPerPage: 50,
                    pageNumber: 1,
                    orderBy: 'interactionCount',
                    order: 'desc',
                    shouldCheckReverse: true,
                },
                connectionDetails
            );
        }
    }

    handleInputChange = (val) => {
        this.setState({
            msgInputVal: val,
        });
    };

    handleSend = () => {
        const { msgInputVal } = this.state;

        if (msgInputVal) {
            const { route, sendDirectMessage, user } = this.props;
            const { connectionDetails } = route.params;

            sendDirectMessage({
                message: msgInputVal,
                userId: user.details && user.details.id,
                userName: user.details && user.details.userName,
                to: connectionDetails,
            });

            this.setState({
                msgInputVal: '',
            });
        }
    };

    render() {
        const { msgInputVal } = this.state;
        const { messages, route } = this.props;
        const { connectionDetails } = route.params;
        const dms = messages.dms ? (messages.dms[connectionDetails.id] || []) : [];

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView style={[styles.safeAreaView]}>
                    <View style={messageStyles.container}>
                        <View style={styles.body}>
                            <View style={messageStyles.sectionContainer}>
                                <Image
                                    source={{ uri: `https://robohash.org/${connectionDetails.id}?size=50x50` }}
                                    style={messageStyles.userImage}
                                    PlaceholderContent={<ActivityIndicator />}
                                />
                                <Text style={styles.sectionTitle}>
                                    {connectionDetails.firstName}{' '}
                                    {connectionDetails.lastName}
                                </Text>
                            </View>
                        </View>
                        <FlatList
                            data={dms}
                            keyExtractor={(item) => String(item.key)}
                            renderItem={({ item }) => (
                                <TextMessage
                                    message={item}
                                    isLeft={item.fromUserName && item.fromUserName.toLowerCase().includes('you')}
                                />
                            )}
                            ref={(component) => (this.flatListRef = component)}
                            style={styles.stretch}
                            onContentSizeChange={() => dms.length && this.flatListRef.scrollToEnd({ animated: true })}
                        />
                        <View style={messageStyles.sendInputsContainer}>
                            <RoundInput
                                value={msgInputVal}
                                onChangeText={this.handleInputChange}
                                placeholder={this.translate(
                                    'pages.directMessage.inputPlaceholder'
                                )}
                                onSubmitEditing={() => this.handleSend()}
                                containerStyle={messageStyles.inputContainer}
                                errorStyle={styles.displayNone}
                            />
                            <Button
                                icon={<Icon name="send" size={26} style={messageStyles.icon} />}
                                buttonStyle={messageStyles.sendBtn}
                                containerStyle={messageStyles.sendBtnContainer}
                                onPress={this.handleSend}
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(DirectMessage);
