import React from 'react';
import { Platform, TextInput as RNTextInput, TextInputProps, View } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import 'react-native-gesture-handler';
import { IMapState as IMapReduxState } from 'therr-react/types';
import translator from '../../utilities/translator';
import { ITherrThemeColors, ITherrThemeColorVariations } from '../../styles/themes';
import UsersActions from '../../redux/actions/UsersActions';
import TherrIcon from '../TherrIcon';
import localStyles from './headerSearchStyles';


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
        const placeholderText = this.translate('components.header.searchUsersInput.placeholder');

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
            <View style={[theme.styles.headerSearchContainer, inputContainerStyle]}>
                <RNTextInput
                    onChangeText={this.onInputChange}
                    placeholder={placeholderText}
                    placeholderTextColor={theme.colorVariations.textGrayFade}
                    selectionColor={themeForms.colors.selectionColor as unknown as string}
                    cursorColor={themeForms.colors.selectionColor as unknown as string}
                    style={textInputStyle}
                    value={inputText}
                />
                <View style={localStyles.iconButton}>
                    <TherrIcon
                        name={'search'}
                        size={18}
                        color={theme.colors.primary3}
                    />
                </View>
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderSearchUsersInput);
