import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput as RNTextInput, TextInputProps, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Badge } from 'react-native-paper';
import 'react-native-gesture-handler';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState as IMapReduxState } from 'therr-react/types';
import { FeatureFlags } from 'therr-js-utilities/constants';
import translator from '../../utilities/translator';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import TherrIcon from '../TherrIcon';
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../../constants';
import getConfig from '../../utilities/getConfig';


interface IHeaderSearchInputState {
    inputText: string;
    lastSearchRequest: any;
    lastClickedTargetId: any;
    overlayTopOffset: number;
    overlayLeftOffset: number;
    shouldEvaluateClickaway: boolean;
}
interface IHeaderSearchInputDispatchProps extends Omit<TextInputProps, 'ref'> {
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IHeaderSearchInputStoreProps extends IHeaderSearchInputDispatchProps {
    content: IContentState;
    map: IMapReduxState;
    user: any;
    theme: {
        colors: ITherrThemeColors;
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    placeholderText: string;
}

interface IHeaderSearchInputProps extends IHeaderSearchInputStoreProps {
    isAdvancedSearch?: Boolean;
    navigation: any;
}

const mapStateToProps = (state: any) => ({
    content: state.content,
    map: state.map,
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            getPlacesSearchAutoComplete: MapActions.getPlacesSearchAutoComplete,
            setSearchDropdownVisibility: MapActions.setSearchDropdownVisibility,
        },
        dispatch
    );

export class HeaderSearchInput extends React.Component<IHeaderSearchInputProps, IHeaderSearchInputState> {
    private translate: Function;
    private throttleTimeoutId: any;
    containerRef: any;

    constructor(props: IHeaderSearchInputProps) {
        super(props);

        this.state = {
            inputText: '',
            lastSearchRequest: Date.now(),
            lastClickedTargetId: '',
            overlayTopOffset: 100,
            overlayLeftOffset: 0,
            shouldEvaluateClickaway: false,
        };

        this.translate = (key: string, params: any) => translator(props.user?.settings?.locale || 'en-us', key, params);
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    onInputChange = (text: string, invoker: string = 'input') => {
        const { getPlacesSearchAutoComplete, map, setSearchDropdownVisibility } = this.props;
        const { inputText } = this.state;

        clearTimeout(this.throttleTimeoutId);
        this.setState({
            inputText: text,
        });

        if (invoker === 'input' && text === inputText) {
            return;
        }
        setSearchDropdownVisibility(!!text?.length);

        this.throttleTimeoutId = setTimeout(() => {
            const config = getConfig();
            const useMapboxSearch = config.featureFlags?.[FeatureFlags.ENABLE_MAPBOX_SEARCH] === true;
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || DEFAULT_LONGITUDE.toString(),
                latitude: map?.latitude || DEFAULT_LATITUDE.toString(),
                input: text,
            }, useMapboxSearch);
        }, 300);
    };

    handlePress = (invoker: string) => {
        const { isAdvancedSearch, navigation, setSearchDropdownVisibility } = this.props;
        const { inputText } = this.state;

        if (isAdvancedSearch) {
            navigation.navigate('AdvancedSearch');
        } else {
            setSearchDropdownVisibility(!!inputText?.length);

            this.onInputChange(inputText || '', invoker);

        }
    };

    render() {
        const { inputText } = this.state;
        const { content, isAdvancedSearch, map, theme, themeForms, placeholderText } = this.props;
        const mapFilters = {
            filtersAuthor: map.filtersAuthor,
            filtersCategory: map.filtersCategory,
            filtersVisibility: map.filtersVisibility,
        };
        let filterCount = 0;
        Object.keys(mapFilters).forEach(key => {
            if (mapFilters[key]?.length && !mapFilters[key][0].isChecked) {
                filterCount += 1;
            }
        });
        if (content.activeAreasFilters?.contentType && content.activeAreasFilters.contentType !== 'all') {
            filterCount += 1;
        }

        const inputContainerStyle = [
            themeForms.styles.inputContainerRound,
            theme.styles.headerSearchInputContainer,
            localStyles.row,
        ];

        const textInputStyle = [
            Platform.OS !== 'ios' ? themeForms.styles.input : themeForms.styles.inputAlt,
            localStyles.flex,
            localStyles.textInputBase,
            Platform.OS !== 'ios' ? localStyles.fontSizeDefault : localStyles.fontSizeIos,
        ];

        return (
            <>
                <View style={[theme.styles.headerSearchContainer, inputContainerStyle]}>
                    {isAdvancedSearch ? (
                        // Areas screen: tapping the field navigates to AdvancedSearch instead of
                        // accepting input in place. Wrap the input area in a Pressable so taps on
                        // the text region (not just the icon) still trigger the navigation, and
                        // make the inner field non-editable to suppress the keyboard.
                        <Pressable
                            style={localStyles.flexRow}
                            onPress={() => this.handlePress('onpress')}
                        >
                            <RNTextInput
                                editable={false}
                                pointerEvents="none"
                                placeholder={placeholderText}
                                placeholderTextColor={theme.colorVariations.textGrayFade}
                                style={textInputStyle}
                                value={inputText}
                            />
                        </Pressable>
                    ) : (
                        <RNTextInput
                            onChangeText={this.onInputChange}
                            onFocus={() => this.handlePress('onfocus')}
                            placeholder={placeholderText}
                            placeholderTextColor={theme.colorVariations.textGrayFade}
                            selectionColor={themeForms.colors.selectionColor as unknown as string}
                            cursorColor={themeForms.colors.selectionColor as unknown as string}
                            style={textInputStyle}
                            value={inputText}
                        />
                    )}
                    <Pressable
                        onPress={() => this.handlePress('onpress')}
                        hitSlop={8}
                        style={localStyles.iconButton}
                    >
                        <TherrIcon
                            name={isAdvancedSearch ? 'filters' : 'search'}
                            size={18}
                            color={theme.colors.primary3}
                        />
                    </Pressable>
                </View>
                {
                    isAdvancedSearch && filterCount > 0 &&
                    <View style={themeForms.styles.headerInputBadgeContainer}>
                        <Badge style={themeForms.styles.headerInputBadge}>
                            {filterCount}
                        </Badge>
                    </View>
                }
            </>
        );
    }
}

const localStyles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    flexRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    iconButton: {
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textInputBase: {
        margin: 0,
        padding: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    fontSizeDefault: {
        fontSize: 16,
    },
    fontSizeIos: {
        fontSize: 19,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchInput);
