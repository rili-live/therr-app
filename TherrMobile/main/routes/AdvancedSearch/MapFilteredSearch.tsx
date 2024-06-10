import React from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ContentActions, MapActions } from 'therr-react/redux/actions';
import { IMapState, IUserState } from 'therr-react/types';
import { ListItem } from 'react-native-elements';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import { buildStyles } from '../../styles';
import { buildStyles as buildButtonStyles } from '../../styles/buttons';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import translator from '../../services/translator';
import MainButtonMenu from '../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';
import { allCategories, SELECT_ALL } from '../../utilities/categories';
import { getInitialAuthorFilters, getInitialCategoryFilters, getInitialVisibilityFilters } from '../../utilities/getInitialFilters';

export const authorOptions: { name: string; isChecked?: boolean }[] = [{ name: SELECT_ALL }, { name: 'me' }, { name: 'notMe' }];

export const categoryOptions: { name: string; isChecked?: boolean }[] = allCategories.map(cat => ({ name: cat, data: [] }));

export const visibilityOptions: { name: string; isChecked?: boolean }[] = [{ name: SELECT_ALL }, { name: 'public' }, { name: 'private' }];


// const { width: viewportWidth, height: viewportHeight } = Dimensions.get('window');

interface IMapFilteredSearchDispatchProps {
    setMapFilters: Function;
}

interface IStoreProps extends IMapFilteredSearchDispatchProps {
    map: IMapState;
    user: IUserState;
}

// Regular component props
export interface IMapFilteredSearchProps extends IStoreProps {
    navigation: any;
}

interface IMapFilteredSearchState {
    isLoading: boolean;
    hasChanges: boolean;
    authorFilters: { title: string; name: string; isChecked?: boolean }[],
    categoryFilters: { title: string; name: string; isChecked?: boolean }[],
    visibilityFilters: { title: string; name: string; isChecked?: boolean }[],
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            setMapFilters: MapActions.setMapFilters,
            updateActiveMomentsStream: ContentActions.updateActiveMomentsStream,
        },
        dispatch
    );

class MapFilteredSearch extends React.Component<IMapFilteredSearchProps, IMapFilteredSearchState> {
    private initialAuthorFilters;
    private initialCategoryFilters;
    private initialVisibilityFilters;
    private translate: Function;
    private theme = buildStyles();
    private themeButtons = buildButtonStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) =>
            translator('en-us', key, params);
        this.initialAuthorFilters = getInitialAuthorFilters(this.translate);
        this.initialCategoryFilters = getInitialCategoryFilters(this.translate);
        this.initialVisibilityFilters = getInitialVisibilityFilters(this.translate);
        const filtersArePopulated = props.map.filtersAuthor?.length && props.map.filtersCategory?.length && props.map.filtersVisibility?.length;

        this.state = {
            isLoading: true,
            hasChanges: false,
            authorFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersAuthor))
                : this.initialAuthorFilters.map(x => ({ ...x, isChecked: true})),
            categoryFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersCategory))
                : this.initialCategoryFilters.map(x => ({ ...x, isChecked: true})),
            visibilityFilters: filtersArePopulated
                ? JSON.parse(JSON.stringify(props.map.filtersVisibility))
                : this.initialVisibilityFilters.map(x => ({ ...x, isChecked: true})),
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeButtons = buildButtonStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.mapFilteredSearch.headerTitle'),
        });
    }

    handleApplyFilters = (shouldNavigate = false) => {
        const { authorFilters, categoryFilters, visibilityFilters } = this.state;
        const { setMapFilters } = this.props;

        setMapFilters({
            filtersAuthor: authorFilters,
            filtersCategory: categoryFilters,
            filtersVisibility: visibilityFilters,
        });

        if (shouldNavigate) {
            const { navigation } = this.props;
            navigation.goBack();
        }
    };

    handleResetFilters = (shouldNavigate = false) => {
        this.setState({
            authorFilters: this.initialAuthorFilters.map(x => ({ ...x, isChecked: true})),
            categoryFilters: this.initialCategoryFilters.map(x => ({ ...x, isChecked: true})),
            visibilityFilters: this.initialVisibilityFilters.map(x => ({ ...x, isChecked: true})),
        }, this.handleApplyFilters);
        if (shouldNavigate) {
            const { navigation } = this.props;
            navigation.goBack();
        }
    };

    isSelectAll = (title: string) => {
        return title === this.translate('pages.mapFilteredSearch.labels.selectAll') || title === this.translate('pages.mapFilteredSearch.labels.unSelectAll');
    };

    onRefresh = () => {
        console.log('Refresh');
    };

    onCheckmarkPress = (filterGroup: 'authorFilters' | 'categoryFilters' | 'visibilityFilters', index, isSelectAll: boolean = false) => {
        let modifiedGroup = this.state[filterGroup];
        modifiedGroup[index].isChecked = !modifiedGroup[index].isChecked;
        if (isSelectAll) {
            modifiedGroup = modifiedGroup.map(x => ({ ...x, isChecked: modifiedGroup[index].isChecked}));
        } else {
            // Select All box
            modifiedGroup[0].isChecked = modifiedGroup.every((item, index) => {
                if (index === 0) { return true; }
                return item.isChecked;
            });
        }

        if (modifiedGroup[0].isChecked) {
            modifiedGroup[0].title = this.translate('pages.mapFilteredSearch.labels.unSelectAll');
        } else {
            modifiedGroup[0].title = this.translate('pages.mapFilteredSearch.labels.selectAll');
        }

        // Make sure one of public or private is always checked
        if (!modifiedGroup[index].isChecked) {
            if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.public')) {
                const privateBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.private'));
                modifiedGroup[privateBoxIndex].isChecked = true;
            } else if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.private')) {
                const publicBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.public'));
                modifiedGroup[publicBoxIndex].isChecked = true;
            }
        }

        // Make sure one of me or NOT me is always checked
        if (!modifiedGroup[index].isChecked) {
            if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.me')) {
                const notMeBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.notMe'));
                modifiedGroup[notMeBoxIndex].isChecked = true;
            } else if (modifiedGroup[index].title === this.translate('pages.mapFilteredSearch.labels.notMe')) {
                const meBoxIndex = modifiedGroup.findIndex((box) => box.title === this.translate('pages.mapFilteredSearch.labels.me'));
                modifiedGroup[meBoxIndex].isChecked = true;
            }
        }

        this.setState({
            [filterGroup]: modifiedGroup,
        } as any);
    };

    render() {
        const { navigation, user } = this.props;
        const { authorFilters, categoryFilters, visibilityFilters } = this.state;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        contentInsetAdjustmentBehavior="automatic"
                        style={this.theme.styles.scrollViewFull}
                    >
                        <View style={[this.theme.styles.body, { marginBottom: 80 }]}>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {this.translate('pages.mapFilteredSearch.h2.categoryFilters')}
                                </Text>
                                {
                                    categoryFilters.map((item, index) => (
                                        <ListItem
                                            key={index}
                                            onPress={() => this.onCheckmarkPress('categoryFilters', index, this.isSelectAll(item.title))}
                                            bottomDivider
                                            containerStyle={this.theme.styles.listItemCard}
                                        >
                                            <ListItem.Content>
                                                <ListItem.Title>{item.title}</ListItem.Title>
                                            </ListItem.Content>
                                            <ListItem.CheckBox
                                                checked={item.isChecked}
                                                onPress={() => this.onCheckmarkPress('categoryFilters', index, this.isSelectAll(item.title))}
                                                checkedColor={this.theme.colors.brandingBlueGreen}
                                            />
                                        </ListItem>
                                    ))
                                }
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {this.translate('pages.mapFilteredSearch.h2.visibilityFilters')}
                                </Text>
                                {
                                    visibilityFilters.map((item, index) => (
                                        <ListItem
                                            key={index}
                                            onPress={() => this.onCheckmarkPress('visibilityFilters', index, this.isSelectAll(item.title))}
                                            bottomDivider
                                            containerStyle={this.theme.styles.listItemCard}
                                        >
                                            <ListItem.Content>
                                                <ListItem.Title>{item.title}</ListItem.Title>
                                            </ListItem.Content>
                                            <ListItem.CheckBox
                                                checked={item.isChecked}
                                                onPress={() => this.onCheckmarkPress('visibilityFilters', index, this.isSelectAll(item.title))}
                                                checkedColor={this.theme.colors.brandingBlueGreen}
                                            />
                                        </ListItem>
                                    ))
                                }
                            </View>
                            <View style={this.theme.styles.sectionContainer}>
                                <Text style={this.theme.styles.sectionTitle}>
                                    {this.translate('pages.mapFilteredSearch.h2.authorFilters')}
                                </Text>
                                {
                                    authorFilters.map((item, index) => (
                                        <ListItem
                                            key={index}
                                            onPress={() => this.onCheckmarkPress('authorFilters', index, this.isSelectAll(item.title))}
                                            bottomDivider
                                            containerStyle={this.theme.styles.listItemCard}
                                        >
                                            <ListItem.Content>
                                                <ListItem.Title>{item.title}</ListItem.Title>
                                            </ListItem.Content>
                                            <ListItem.CheckBox
                                                checked={item.isChecked}
                                                onPress={() => this.onCheckmarkPress('authorFilters', index, this.isSelectAll(item.title))}
                                                checkedColor={this.theme.colors.brandingBlueGreen}
                                            />
                                        </ListItem>
                                    ))
                                }
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
                <View style={this.themeButtons.styles.resetFilters}>
                    <Button
                        containerStyle={this.themeButtons.styles.btnContainer}
                        buttonStyle={this.themeButtons.styles.btnLargeWithText}
                        icon={
                            <FontAwesome5Icon
                                name="redo-alt"
                                size={24}
                                style={this.themeButtons.styles.btnIcon}
                            />
                        }
                        raised
                        title={this.translate('menus.filterActions.resetFilters')}
                        titleStyle={this.themeButtons.styles.btnMediumTitleRight}
                        onPress={() => this.handleResetFilters(true)}
                    />
                </View>
                <View style={this.themeButtons.styles.applyFilters}>
                    <Button
                        containerStyle={this.themeButtons.styles.btnContainer}
                        buttonStyle={this.themeButtons.styles.btnLargeWithText}
                        icon={
                            <FontAwesome5Icon
                                name="check"
                                size={24}
                                style={this.themeButtons.styles.btnIcon}
                            />
                        }
                        // iconRight
                        raised
                        title={this.translate('menus.filterActions.applyFilters')}
                        titleStyle={this.themeButtons.styles.btnMediumTitleRight}
                        onPress={() => this.handleApplyFilters(true)}
                    />
                </View>
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

export default connect(mapStateToProps, mapDispatchToProps)(MapFilteredSearch);
