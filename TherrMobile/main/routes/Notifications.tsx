import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import styles from '../styles';
import translator from '../services/translator';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';

interface INotificationsDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends INotificationsDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface INotificationsProps extends IStoreProps {
    navigation: any;
}

interface INotificationsState {}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class Notifications extends React.Component<
    INotificationsProps,
    INotificationsState
> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any): string =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.notifications.headerTitle'),
        });
    }

    render() {
        const { navigation, user } = this.props;
        const pageTitle = this.translate('pages.notifications.pageTitle');

        return (
            <>
                <StatusBar barStyle="dark-content" />
                <SafeAreaView>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollView}
                    >
                        <View style={styles.body}>
                            <View style={styles.sectionContainer}>
                                <Text style={styles.sectionTitle}>
                                    {pageTitle.toString()}
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <MainButtonMenu navigation={navigation} user={user} />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Notifications);
