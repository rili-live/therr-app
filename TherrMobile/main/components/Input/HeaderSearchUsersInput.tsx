import React from 'react';
import { Platform, StyleSheet, TextInput as RNTextInput, TextInputProps } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import 'react-native-gesture-handler';
import { IMapState as IMapReduxState } from 'therr-react/types';
import RoundInput from '.';
import translator from '../../utilities/translator';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import UsersActions from '../../redux/actions/UsersActions';
import TherrIcon from '../TherrIcon';


interface IHeaderSearchUsersInputState {
    inputText: string;
}
interface IHeaderSearchUsersInputDispatchProps extends Omit<TextInputProps, 'ref'> {
    searchUsers: Function;
}

interface IHeaderSearchUsersInputStoreProps extends IHeaderSearchUsersInputDispatchProps {
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
}

interface IHeaderSearchUsersInputProps extends IHeaderSearchUsersInputStoreProps {
    navigation: any;
}

const mapStateToProps = (state: any) => ({
    map: state.map,
    user: state.user,
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

        this.translate = (key: string, params: any) => translator(props.user?.settings?.locale || 'en-us', key, params);
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
        const placeholderText = this.translate('components.header.searchUsersInput.placeholder');
        return (
            <>
                <RoundInput
                    errorStyle={localStyles.hidden}
                    style={textStyle}
                    containerStyle={theme.styles.headerSearchContainer}
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
                    placeholder={placeholderText}
                    placeholderTextColor={theme.colorVariations.textGrayFade}
                    render={(inputProps) => (
                        <RNTextInput
                            {...inputProps}
                            placeholder={placeholderText}
                            placeholderTextColor={theme.colorVariations.textGrayFade}
                        />
                    )}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
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

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchUsersInput);
