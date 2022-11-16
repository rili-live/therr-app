import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Badge, InputProps } from 'react-native-elements';
import 'react-native-gesture-handler';
import { MapActions } from 'therr-react/redux/actions';
import { IMapReduxState } from 'therr-react/types';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';
import DeviceInfo from 'react-native-device-info';
import RoundInput from './';
import translator from '../../services/translator';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import TherrIcon from '../TherrIcon';


const { width: screenWidth } = Dimensions.get('window');

interface IHeaderSearchInputState {
    inputText: string;
    lastSearchRequest: any;
    lastClickedTargetId: any;
    overlayTopOffset: number;
    overlayLeftOffset: number;
    shouldEvaluateClickaway: boolean;
}
interface IHeaderSearchInputDispatchProps extends InputProps {
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IHeaderSearchInputStoreProps extends IHeaderSearchInputDispatchProps {
    map: IMapReduxState;
    theme: {
        colors: ITherrThemeColors;
        colorVariations: ITherrThemeColorVariations;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

interface IHeaderSearchInputProps extends IHeaderSearchInputStoreProps {
    isAdvancedSearch?: Boolean;
    navigation: any;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
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

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    }

    onInputChange = (text: string) => {
        const { getPlacesSearchAutoComplete, map, setSearchDropdownVisibility } = this.props;
        clearTimeout(this.throttleTimeoutId);
        this.setState({
            inputText: text,
        });

        this.throttleTimeoutId = setTimeout(() => {
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || '37.76999',
                latitude: map?.latitude || '-122.44696',
                // radius,
                apiKey: Platform.OS === 'ios' ? GOOGLE_APIS_IOS_KEY : GOOGLE_APIS_ANDROID_KEY,
                input: text,
            });
        }, 500);

        setSearchDropdownVisibility(!!text?.length);
    }

    handlePress = () => {
        const { isAdvancedSearch, navigation, setSearchDropdownVisibility } = this.props;
        const { inputText } = this.state;

        if (isAdvancedSearch) {
            navigation.navigate('AdvancedSearch');
        } else {
            this.onInputChange(inputText || '');
            setSearchDropdownVisibility(!!inputText?.length);
        }
    }

    // TODO: Display red dot to show filters enabled
    render() {
        const { inputText } = this.state;
        const { isAdvancedSearch, map, theme, themeForms } = this.props;
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

        return (
            <>
                <RoundInput
                    errorStyle={{ display: 'none' }}
                    style={textStyle}
                    containerStyle={[theme.styles.headerSearchContainer, { width: containerWidth }]}
                    inputStyle={
                        [
                            Platform.OS !== 'ios'
                                ? themeForms.styles.input
                                : themeForms.styles.inputAlt,
                            { fontSize: Platform.OS !== 'ios' ? 16 : 19 },
                        ]
                    }
                    inputContainerStyle={[themeForms.styles.inputContainerRound, theme.styles.headerSearchInputContainer]}
                    onChangeText={this.onInputChange}
                    onFocus={this.handlePress}
                    placeholder={this.translate('components.header.searchInput.placeholder')}
                    placeholderTextColor={theme.colorVariations.textGrayFade}
                    rightIcon={
                        <TherrIcon
                            name={isAdvancedSearch ? 'filters' : 'search'}
                            size={18}
                            color={theme.colors.primary3}
                            onPress={this.handlePress}
                        />
                    }
                    themeForms={themeForms}
                    value={inputText}
                />
                {
                    isAdvancedSearch && filterCount > 0 &&
                    <Badge
                        value={filterCount}
                        badgeStyle={themeForms.styles.headerInputBadge}
                        containerStyle={themeForms.styles.headerInputBadgeContainer}
                    />
                }
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchInput);
