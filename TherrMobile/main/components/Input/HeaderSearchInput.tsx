import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Badge } from 'react-native-paper';
import { TextInputProps } from 'react-native';
import 'react-native-gesture-handler';
import { MapActions } from 'therr-react/redux/actions';
import { IContentState, IMapState as IMapReduxState } from 'therr-react/types';
import DeviceInfo from 'react-native-device-info';
import RoundInput from './';
import translator from '../../services/translator';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import TherrIcon from '../TherrIcon';
import { DEFAULT_LATITUDE, DEFAULT_LONGITUDE } from '../../constants';


const { width: screenWidth } = Dimensions.get('window');

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
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || DEFAULT_LONGITUDE.toString(),
                latitude: map?.latitude || DEFAULT_LATITUDE.toString(),
                // radius,
                input: text,
            });
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

    // TODO: Display red dot to show filters enabled
    render() {
        const { inputText } = this.state;
        const { content, isAdvancedSearch, map, theme, themeForms, placeholderText } = this.props;
        const textStyle = !inputText?.length
            ? [themeForms.styles.placeholderText, { fontSize: 16 }]
            : [themeForms.styles.inputText, { fontSize: 16 }];
        const containerWidth = DeviceInfo.isTablet()
            ? screenWidth - 248
            : screenWidth - 124;
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

        return (
            <>
                <RoundInput
                    errorStyle={localStyles.hidden}
                    style={textStyle}
                    containerStyle={[theme.styles.headerSearchContainer, { width: containerWidth }]}
                    inputStyle={
                        [
                            Platform.OS !== 'ios'
                                ? themeForms.styles.input
                                : themeForms.styles.inputAlt,
                            Platform.OS !== 'ios'
                                ? localStyles.fontSizeDefault
                                : localStyles.fontSizeIos,
                        ]
                    }
                    inputContainerStyle={[themeForms.styles.inputContainerRound, theme.styles.headerSearchInputContainer]}
                    roundness={18}
                    onChangeText={this.onInputChange}
                    onFocus={() => this.handlePress('onfocus')}
                    placeholder={placeholderText}
                    placeholderTextColor={theme.colorVariations.textGrayFade}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    dense
                    rightIcon={
                        <TherrIcon
                            name={isAdvancedSearch ? 'filters' : 'search'}
                            size={18}
                            color={theme.colors.primary3}
                            onPress={() => this.handlePress('onpress')}
                        />
                    }
                    themeForms={themeForms}
                    value={inputText}
                />
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
    hidden: {
        display: 'none',
    },
    fontSizeDefault: {
        fontSize: 16,
    },
    fontSizeIos: {
        fontSize: 19,
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchInput);
