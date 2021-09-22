import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { InputProps } from 'react-native-elements';
import 'react-native-gesture-handler';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { MapActions } from 'therr-react/redux/actions';
import { IMapReduxState } from 'therr-react/types';
import { GOOGLE_APIS_ANDROID_KEY, GOOGLE_APIS_IOS_KEY } from 'react-native-dotenv';
import RoundInput from '.';
import translator from '../../services/translator';
import * as therrTheme from '../../styles/themes';
import formStyles from '../../styles/forms';

const { width: screenWidth } = Dimensions.get('window');

interface IHeaderSearchInputDispatchProps extends InputProps {
    getPlacesSearchAutoComplete: Function;
    setSearchDropdownVisibility: Function;
}

interface IHeaderSearchInputStoreProps extends IHeaderSearchInputDispatchProps {
    isAdvancedSearch: Boolean;
    map: IMapReduxState;
}

interface IHeaderSearchInputProps extends IHeaderSearchInputStoreProps {
    navigation: any;
    icon: String;
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

export class HeaderSearchInput<IHeaderSearchInputProps> extends RoundInput {
    private translate: Function;
    private throttleTimeoutId: any;
    containerRef: any;

    constructor(props: IHeaderSearchInputProps) {
        super(props as InputProps);

        this.state = {
            lastSearchRequest: Date.now(),
            lastClickedTargetId: '',
            overlayTopOffset: 100,
            overlayLeftOffset: 0,
            shouldEvaluateClickaway: false,
            inputText: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    // componentDidUpdate() {
    //     const { lastClickedTargetId, shouldEvaluateClickaway } = this.state;
    //     const { setSearchDropdownVisibility } = this.props;

    //     let isClickOutside = true;
    //     let depth = 0;

    //     if (shouldEvaluateClickaway) {
    //         console.dir(this.containerRef);

    //         let stack = [this.containerRef];

    //         while (stack.length) {
    //             let current: any = stack.shift();

    //             if (!current) {
    //                 if (depth > 10) {
    //                     break;
    //                 } else {
    //                     continue;
    //                 }
    //             }

    //             if (current?._nativeTag === lastClickedTargetId) {
    //                 isClickOutside = false;
    //                 stack = [];
    //                 break; // short-circuit
    //             }

    //             if (current?._children) {
    //                 for (let i = 0; i < current._children.length; i += 1) {
    //                     console.log(current?._children[i]);
    //                     stack.push(current?._children[i]);
    //                 }
    //                 depth += 1;
    //                 stack.push(null);
    //             }
    //         }

    //         if (isClickOutside) {
    //             setSearchDropdownVisibility(false);
    //         }

    //         this.setState({
    //             shouldEvaluateClickaway: false,
    //         });
    //     }
    // }

    onInputChange = (input: string) => {
        const { getPlacesSearchAutoComplete, map, setSearchDropdownVisibility } = this.props;
        clearTimeout(this.throttleTimeoutId);
        this.setState({
            inputText: input,
        });

        this.throttleTimeoutId = setTimeout(() => {
            getPlacesSearchAutoComplete({
                longitude: map?.longitude || '37.76999',
                latitude: map?.latitude || '-122.44696',
                // radius,
                apiKey: Platform.OS === 'ios' ? GOOGLE_APIS_IOS_KEY : GOOGLE_APIS_ANDROID_KEY,
                input,
            });
        }, 500);

        setSearchDropdownVisibility(!!input?.length);
    }

    handlePress = () => {
        const { isAdvancedSearch, navigation, setSearchDropdownVisibility } = this.props;
        const { inputText } = this.state;

        if (isAdvancedSearch) {
            navigation.navigate('AdvancedSearch');
        } else {
            setSearchDropdownVisibility(!!inputText?.length);
            this.onInputChange(inputText || '');
        }
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    }

    // TODO: Display red dot to show filters enabled

    render() {
        const { icon } = this.props;

        return (
            <RoundInput
                errorStyle={{ display: 'none' }}
                containerStyle={[formStyles.headerSearchContainer, { width: screenWidth - 100  }]}
                inputStyle={[Platform.OS !== 'ios' ? formStyles.input : formStyles.inputAlt, { fontSize: Platform.OS !== 'ios' ? 16 : 19 }]}
                inputContainerStyle={[formStyles.inputContainerRound, formStyles.headerSearchInputContainer]}
                onChangeText={this.onInputChange}
                onFocus={this.handlePress}
                placeholder={this.translate('components.header.searchInput.placeholder')}
                rightIcon={
                    <MaterialIcon
                        name={icon}
                        size={22}
                        color={therrTheme.colors.primary3}
                    />
                }
                {...this.props}
            />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchInput);
