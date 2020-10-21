import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
import MainButtonMenu from '../components/ButtonMenu/MainButtonMenu';
import styles from '../styles';
import translator from '../services/translator';

interface ISettingsDispatchProps {}

interface IStoreProps extends ISettingsDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ISettingsProps extends IStoreProps {
    navigation: any;
}

interface ISettingsState {}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({}, dispatch);

class Settings extends React.Component<ISettingsProps, ISettingsState> {
    private translate: Function; // eslint-disable-line react/sort-comp

    constructor(props) {
        super(props);

        this.state = {};

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        this.props.navigation.setOptions({
            title: this.translate('pages.settings.headerTitle'),
        });
    }

    render() {
        const { navigation, user } = this.props;
        const pageTitle = this.translate('pages.settings.pageTitle');

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
                                    {pageTitle}
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

export default connect(mapStateToProps, mapDispatchToProps)(Settings);
