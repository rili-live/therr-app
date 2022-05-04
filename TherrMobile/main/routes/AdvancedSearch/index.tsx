import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { Picker as ReactPicker } from '@react-native-picker/picker';
import { bindActionCreators } from 'redux';
import { ContentActions } from 'therr-react/redux/actions';
import { IContentState, IUserState, IUserConnectionsState } from 'therr-react/types';
import { buildStyles } from '../../styles';
import { buildStyles as buildFormStyles } from '../../styles/forms';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
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
    private theme = buildStyles();
    private themeForms = buildFormStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
            hasChanges: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeForms = buildFormStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
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
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colorVariations.backgroundNeutral }]}>
                    <View style={this.theme.styles.body}>
                        <View style={this.theme.styles.sectionContainer}>
                            <Text style={this.theme.styles.sectionTitle}>
                                {this.translate('pages.advancedSearch.labels.searchOrder')}
                            </Text>
                            <View style={this.theme.styles.sectionForm}>
                                <ReactPicker
                                    selectedValue={content.activeAreasFilters.order}
                                    style={this.themeForms.styles.picker}
                                    itemStyle={this.themeForms.styles.pickerItem}
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
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AdvancedSearch);
