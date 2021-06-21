import React from 'react';
import { Dimensions, SafeAreaView, Text, StatusBar } from 'react-native';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import * as therrTheme from '../styles/themes';
import styles from '../../styles';
import momentStyles from '../../styles/user-content/moments';
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
    private translate: Function;

    constructor(props) {
        super(props);

        this.state = {
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { content, navigation, updateActiveMoments } = this.props;

        navigation.setOptions({
            title: this.translate('pages.moments.headerTitle'),
        });

        if (!content.activeMoments || !content.activeMoments.length) {
            updateActiveMoments();
        }
    }

    render() {
        const { content } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} backgroundColor="transparent"  />
                <SafeAreaView style={styles.safeAreaView}>
                    {
                        content.activeMoments?.length ?
                            <MomentCarousel
                                content={content}
                                translate={this.translate}
                                viewportHeight={viewportHeight}
                                viewportWidth={viewportWidth}
                            /> :
                            <Text style={momentStyles.noMomentsFoundText}>{this.translate('pages.moments.noMomentsFound')}</Text>
                    }
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Moments);
