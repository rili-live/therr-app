import React from 'react';
import { Dimensions, SafeAreaView, Text, StatusBar } from 'react-native';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import * as therrTheme from '../styles/themes';
import styles from '../../styles';
import momentStyles from '../../styles/user-content/moments';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MomentCarousel from './MomentCarousel';

const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

interface IMomentsDispatchProps {
    searchActiveMoments: Function;
    updateActiveMoments: Function;
    logout: Function;
}

interface IStoreProps extends IMomentsDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IMomentsProps extends IStoreProps {
    navigation: any;
}

interface IMomentsState {
    isLoading: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchActiveMoments: ContentActions.searchActiveMoments,
            updateActiveMoments: ContentActions.updateActiveMoments,
        },
        dispatch
    );

class Moments extends React.Component<IMomentsProps, IMomentsState> {
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
        const { content, navigation, updateActiveMoments } = this.props;

        navigation.setOptions({
            title: this.translate('pages.moments.headerTitle'),
        });

        if (!content.activeMoments || !content.activeMoments.length || content.activeMoments.length < 21) {
            updateActiveMoments().then(() => {
                this.setState({
                    isLoading: false,
                });
            });
        } else {
            this.setState({
                isLoading: false,
            });
        }
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

    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    }

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
            <Text style={momentStyles.noMomentsFoundText}>{this.translate('pages.moments.noMomentsFound')}</Text>
        );
    }

    render() {
        const { content, navigation, user } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView style={[styles.safeAreaView, { paddingBottom: buttonMenuHeight }]}>
                    {
                        this.renderCarousel(content)
                    }
                </SafeAreaView>
                <MainButtonMenu navigation={navigation} onActionButtonPress={this.scrollTop} translate={this.translate} user={user} />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Moments);
