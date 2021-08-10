import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UserConnectionsActions } from 'therr-react/redux/actions';
import { IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenuAlt from '../components/ButtonMenu/MainButtonMenuAlt';
import UsersActions from '../redux/actions/UsersActions';
import BaseStatusBar from '../components/BaseStatusBar';
import translator from '../services/translator';
import styles from '../styles';
import momentStyles from '../styles/user-content/moments';
import MomentCarousel from './Moments/MomentCarousel';

interface IBookMarkedDispatchProps {
    createUserConnection: Function;
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IBookMarkedDispatchProps {
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IBookMarkedProps extends IStoreProps {
    navigation: any;
}

interface IBookMarkedState {
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            createUserConnection: UserConnectionsActions.create,
            logout: UsersActions.logout,
            searchUserConnections: UserConnectionsActions.search,
        },
        dispatch
    );

class BookMarked extends React.Component<IBookMarkedProps, IBookMarkedState> {
    private carouselRef;
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.bookmarked.headerTitle'),
        });

        this.setState({
            isLoading: false,
        });
    }


    handleRefresh = () => {
        console.log('refresh');
    }

    goToMoment = (moment) => {
        const { navigation, user } = this.props;

        // navigation.navigate('Home');
        navigation.navigate('ViewMoment', {
            isMyMoment: moment.fromUserId === user.details.id,
            previousView: 'Moments',
            moment,
            momentDetails: {},
        });
    };

    renderCarousel = (content) => {
        const { isLoading } = this.state;

        if (isLoading) {
            return (
                <Text style={momentStyles.noMomentsFoundText}>Loading...</Text>
            );
        }

        if (content.activeMoments?.length) {
            return (
                <MomentCarousel
                    content={content}
                    expandMoment={this.goToMoment}
                    translate={this.translate}
                    containerRef={(component) => this.carouselRef = component}
                    // viewportHeight={viewportHeight}
                    // viewportWidth={viewportWidth}
                />
            );
        }

        return (
            <Text style={momentStyles.noMomentsFoundText}>{this.translate('pages.bookmarked.noBookmarksFound')}</Text>
        );
    }

    render() {
        const { navigation, user } = this.props;
        const content = []; // TODO - Get Favorites

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={styles.safeAreaView}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
                <MainButtonMenuAlt
                    navigation={navigation}
                    onActionButtonPress={this.handleRefresh}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookMarked);
