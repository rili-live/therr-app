import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import styles from '../styles';
import translator from '../services/translator';

interface IConnectionsDispatchProps {
    logout: Function;
    searchUserConnections: Function;
}

interface IStoreProps extends IConnectionsDispatchProps {}

// Regular component props
export interface IConnectionsProps extends IStoreProps {}

interface IConnectionsState {}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class Connections extends React.Component<
    IConnectionsProps,
    IConnectionsState
> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {}

    render() {
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
                                    Connections
                                </Text>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Connections);
