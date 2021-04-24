import React from 'react';
import { Dimensions, SafeAreaView, View, Text, StatusBar } from 'react-native';
// import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Carousel from 'react-native-snap-carousel';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
// import * as therrTheme from '../styles/themes';
import styles from '../styles';
import translator from '../services/translator';

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
            updateActiveMoments(0);
        }
    }

    renderItem = ({ item: moment }) => {
        return (
            <View style={{
                flex: 1,
            }}>
                <Text style={{ fontSize: 30, color: 'white' }}>{ moment.notificationMsg }</Text>
                <Text style={{ fontSize: 20, color: 'white' }}>{ moment.message }</Text>
                <Text style={{ fontSize: 14, color: 'white' }}>{ moment.createdAt }</Text>
                <Text style={{ fontSize:12, color: 'white' }}>{ moment.latitude } { moment.longitude }</Text>
            </View>
        );
    }

    render() {
        const { content } = this.props;

        return (
            <>
                <StatusBar barStyle="light-content" animated={true} translucent={true} />
                <SafeAreaView style={styles.safeAreaView}>
                    <Carousel
                        contentInsetAdjustmentBehavior="automatic"
                        style={styles.scrollViewFull}
                        vertical={true}
                        data={content.activeMoments}
                        renderItem={this.renderItem}
                        sliderWidth={viewportWidth}
                        sliderHeight={viewportHeight}
                        itemWidth={viewportWidth}
                        itemHeight={viewportHeight}
                        slideStyle={{ width: viewportWidth }}
                        inactiveSlideOpacity={1}
                        inactiveSlideScale={1}
                        windowSize={21}
                    />
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Moments);
