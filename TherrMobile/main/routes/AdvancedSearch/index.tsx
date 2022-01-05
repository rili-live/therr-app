import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import styles from '../../styles';
import formStyles from '../../styles/forms';
import * as therrTheme from '../../styles/themes';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';


// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

interface IAdvancedSearchDispatchProps {
    setActiveMomentsFilters: Function;
    updateActiveMoments: Function;
}

interface IStoreProps extends IAdvancedSearchDispatchProps {
    content: IContentState;
    user: IUserState;
    userConnections: IUserConnectionsState;
}

// Regular component props
export interface IAdvancedSearchProps extends IStoreProps {
    navigation: any;
}

interface IAdvancedSearchState {
    isLoading: boolean;
    hasChanges: boolean;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    user: state.user,
    userConnections: state.userConnections,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            setActiveMomentsFilters: ContentActions.setActiveMomentsFilters,
            updateActiveMoments: ContentActions.updateActiveMoments,
        },
        dispatch
    );

class AdvancedSearch extends React.Component<IAdvancedSearchProps, IAdvancedSearchState> {
    private carouselRef;
    private translate: Function;
    private unsubscribeNavListener;

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            hasChanges: false,
        };

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { content, navigation, updateActiveMoments } = this.props;

        navigation.setOptions({
            title: this.translate('pages.advancedSearch.headerTitle'),
        });

        if (!content?.activeAdvancedSearch?.length || content.activeAdvancedSearch.length < 21) {
            Promise.resolve().finally(() => {
                this.setState({
                    isLoading: false,
                });
            });
        } else {
            this.setState({
                isLoading: false,
            });
        }

        this.unsubscribeNavListener = navigation.addListener('beforeRemove', () => {
            updateActiveMoments({
                withMedia: true,
                withUser: true,
                offset: 0,
                ...this.props.content.activeAreasFilters,
            });
        });
    }

    componentWillUnmount() {
        this.unsubscribeNavListener();
    }

    onRefresh = () => {
        console.log('Refresh');
    }

    onFiltersChanged = () => {
        this.setState({
            hasChanges: true,
        });
    }

    onSearchOrderSelect = (searchOrder) => {
        const { setActiveMomentsFilters } = this.props;

        this.onFiltersChanged();
        setActiveMomentsFilters({
            order: searchOrder,
        });
    }

    render() {
        const { content, navigation, user } = this.props;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={[styles.safeAreaView, { backgroundColor: therrTheme.colorVariations.backgroundNeutral }]}>
                    <View style={styles.body}>
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>
                                {this.translate('pages.advancedSearch.labels.searchOrder')}
                            </Text>
                            <View style={styles.sectionForm}>
                                <ReactPicker
                                    selectedValue={content.activeAreasFilters.order}
                                    style={formStyles.picker}
                                    itemStyle={formStyles.pickerItem}
                                    onValueChange={this.onSearchOrderSelect}>
                                    <ReactPicker.Item label={this.translate(
                                        'pages.advancedSearch.labels.desc'
                                    )} value="DESC" />
                                    <ReactPicker.Item label={this.translate(
                                        'pages.advancedSearch.labels.asc'
                                    )} value="ASC" />
                                </ReactPicker>
                            </View>
                        </View>
                    </View>
                </SafeAreaView>
                {/* <MainButtonMenu navigation={navigation} onActionButtonPress={this.scrollTop} translate={this.translate} user={user} /> */}
                <MainButtonMenu
                    navigation={navigation}
                    onActionButtonPress={this.onRefresh}
                    translate={this.translate}
                    user={user}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedSearch);
