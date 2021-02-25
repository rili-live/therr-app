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
// import ViewChatButtonMenu from '../../components/ButtonMenu/ViewChatButtonMenu';
import translator from '../../services/translator';
// import RoundInput from '../../components/Input/Round';
// import * as therrTheme from '../../styles/themes';
import beemoLayoutStyles from '../../styles/layouts/beemo';
import styles from '../../styles';
import HashtagsContainer from '../../components/UserContent/HashtagsContainer';

interface IViewChatDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IViewChatDispatchProps {
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

class ViewChat extends React.Component<IViewChatProps, IViewChatState> {
    private hashtags;
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
        const { navigation, route } = this.props;
        const { title } = route.params;

        navigation.setOptions({
            title,
        });
    }

    render() {
        const { route } = this.props;
        const { description, subtitle } = route.params;

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
                            <Text>{subtitle}</Text>
                            <Text>{description}</Text>
                            <HashtagsContainer
                                hasIcon={false}
                                hashtags={this.hashtags}
                                onHashtagPress={() => {}}
                            />
                        </View>
                    </KeyboardAwareScrollView>
                </SafeAreaView>
                {/* <ViewChatButtonMenu navigation={navigation} translate={this.translate} user={user} /> */}
                {/* Create Chat button */}
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(ViewChat);
