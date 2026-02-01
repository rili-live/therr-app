import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { InputProps } from 'react-native-elements';
import 'react-native-gesture-handler';
import { IMapState as IMapReduxState } from 'therr-react/types';
import DeviceInfo from 'react-native-device-info';
import RoundInput from '.';
import translator from '../../services/translator';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import UsersActions from '../../redux/actions/UsersActions';
import TherrIcon from '../TherrIcon';


const { width: screenWidth } = Dimensions.get('window');

interface IHeaderSearchUsersInputState {
    inputText: string;
}
interface IHeaderSearchUsersInputDispatchProps extends Omit<InputProps, 'ref'> {
    searchUsers: Function;
}

interface IHeaderSearchUsersInputStoreProps extends IHeaderSearchUsersInputDispatchProps {
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

interface IHeaderSearchUsersInputProps extends IHeaderSearchUsersInputStoreProps {
    navigation: any;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {
            searchUsers: UsersActions.search,
        },
        dispatch
    );

export class HeaderSearchUsersInput extends React.Component<IHeaderSearchUsersInputProps, IHeaderSearchUsersInputState> {
    private translate: Function;
    private throttleTimeoutId: any;
    containerRef: any;

    constructor(props: IHeaderSearchUsersInputProps) {
        super(props);

        this.state = {
            inputText: '',
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    componentWillUnmount = () => {
        clearTimeout(this.throttleTimeoutId);
    };

    onInputChange = (text: string) => {
        const { searchUsers } = this.props;

        clearTimeout(this.throttleTimeoutId);

        // TODO: Store in redux so we can reset this value from the Contacts page when user refreshes
        // ...and when Contacts componentDidMount
        this.setState({
            inputText: text,
        });

        this.throttleTimeoutId = setTimeout(() => {
            searchUsers(
                {
                    query: text,
                    limit: 21,
                    offset: 0,
                    withMedia: true,
                },
            )
                .catch(() => {});
        }, 500);
    };

    // TODO: Display red dot to show filters enabled
    render() {
        const { inputText } = this.state;
        const { theme, themeForms } = this.props;
        const textStyle = !inputText?.length
            ? [themeForms.styles.placeholderText, { fontSize: 16 }]
            : [themeForms.styles.inputText, { fontSize: 16 }];
        const containerWidth = DeviceInfo.isTablet()
            ? screenWidth - 248
            : screenWidth - 124;

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
                    placeholder={this.translate('components.header.searchUsersInput.placeholder')}
                    placeholderTextColor={theme.colorVariations.textGrayFade}
                    rightIcon={
                        <TherrIcon
                            name={'search'}
                            size={18}
                            color={theme.colors.primary3}
                        />
                    }
                    themeForms={themeForms}
                    value={inputText}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchUsersInput);
