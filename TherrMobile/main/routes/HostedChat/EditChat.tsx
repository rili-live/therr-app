import React from 'react';
import { SafeAreaView, Text, StatusBar, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
// import EditChatButtonMenu from '../../components/ButtonMenu/EditChatButtonMenu';
import translator from '../../services/translator';
// import RoundInput from '../../components/Input/Round';
// import * as therrTheme from '../../styles/themes';
import beemoLayoutStyles from '../../styles/layouts/beemo';
import styles from '../../styles';

interface IEditChatDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IEditChatDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IEditChatProps extends IStoreProps {
    navigation: any;
}

interface IEditChatState {
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

class EditChat extends React.Component<IEditChatProps, IEditChatState> {
    private scrollViewRef;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.editChat.headerTitleCreate'),
        });

        // TODO: Fetch available rooms on first load
    }

    render() {
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
                        <View style={beemoLayoutStyles.container}>
                            <Text>Placeholder...</Text>
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                {/* <EditChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(EditChat);
