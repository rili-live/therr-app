import React from 'react';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Svg, { Path } from 'react-native-svg';
import translator from '../services/translator';
import { ITherrThemeColors } from '../styles/themes';

interface IHeaderTherrLogoDispatchProps {
}

interface IHeaderTherrLogoStoreProps extends IHeaderTherrLogoDispatchProps {}

interface IHeaderTherrLogoProps extends IHeaderTherrLogoStoreProps {
    navigation: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

const mapStateToProps = () => ({});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {},
        dispatch
    );

export class HeaderTherrLogo extends React.Component<IHeaderTherrLogoProps> {
    private translate: Function;
    containerRef: any;

    constructor(props) {
        super(props);

        this.translate = (key: string, params: any) => translator('en-us', key, params);
    }

    handlePress = () => {
        const { navigation } = this.props;

        navigation.navigate('Home');
    };

    // TODO: Display red dot to show filters enabled

    render() {
        const { theme } = this.props;

        return (
            <View style={theme.styles.headerTitleLogoText}>
                <Svg
                    width={75}
                    height={25}
                    viewBox="0 0 75 25"
                    fill="none"
                >
                    <Path
                        // eslint-disable-next-line max-len
                        d="M3.276.571c-.398.445-.52 1.207-.52 2.858v2.285h-.889C.49 5.714 0 6.444 0 8.54c0 2.095.337 2.571 1.745 2.571h1.01v3.302c0 5.08.857 6.762 3.95 7.714 1.713.508 4.101.444 4.683-.159.459-.476.673-3.047.275-3.778-.214-.444-.765-.698-1.836-.857-.95-.127-1.562-.38-1.684-.698-.092-.286-.184-1.62-.184-3.016v-2.508l1.868.032c2.387.032 2.877-.413 2.877-2.603 0-2.127-.765-2.826-3.092-2.826H7.96V3.397C7.96.507 7.561 0 5.296 0c-1.102 0-1.684.159-2.02.571zM19.776 6.032c-3.276 1.333-5.143 4.254-5.143 8.063 0 5.397 2.908 8.445 8.357 8.699 5.388.285 7.745-1.365 6.245-4.35-.613-1.238-1.225-1.396-3-.793-1.99.698-4.255.476-5.266-.508-.428-.413-.765-.857-.765-1.016 0-.127 1.837-.254 4.102-.254 3.98 0 4.163-.032 5.051-.825 1.653-1.429 1.561-4.667-.183-7.048-1.776-2.413-6.092-3.301-9.398-1.968zm5.204 5.11c.428.477.49.763.244 1.176-.275.412-.887.571-2.693.635-2.633.095-2.817-.096-1.44-1.556 1.133-1.143 2.97-1.302 3.889-.254zM44.598 6.464c1.432.956 2.81 2.49 3.413 3.84 2.312 5.277-1.195 11.861-6.595 12.399-1.57.188-2.295.052-4.637-.697-4.173-1.39-5.55-3.054-4.092-5.015 1.025-1.392 1.851-1.524 3.432-.526.735.467 1.892 1.019 2.542 1.2 1.36.378 3.38-.08 3.57-.816.103-.399-.502-.633-3.902-1.577l-4.022-1.118-.628-1.127c-.533-1.003-.564-1.373-.176-2.876.254-.981.778-2.15 1.194-2.659 1.015-1.23 3.306-2.368 4.77-2.389 1.366-.014 4.124.72 5.13 1.36zm-5.447 3.909c-.241.196-.494.684-.538 1.1-.085.699.054.77 2.337 1.503l2.43.774-.172-.804c-.075-.447-.375-1.123-.659-1.497-.594-.889-2.737-1.55-3.398-1.076zM52.102 6.222c-.673.476-.673.603-.673 7.905v7.46l.765.508c.857.572 3.306.477 3.918-.159.245-.253.429-2.095.52-4.952.154-5.016.399-5.65 1.99-5.65 1.592 0 1.837.634 1.99 5.65.092 3.143.276 4.699.551 4.984.52.54 3.582.54 4.102 0 .276-.285.46-1.84.551-4.984.153-5.016.398-5.65 1.99-5.65s1.837.634 1.99 5.65c.092 3.143.275 4.699.55 4.984.246.254 1.103.413 2.083.413 2.48 0 2.571-.222 2.571-6.032 0-5.619-.398-7.428-1.898-8.952-1.194-1.175-2.327-1.683-3.827-1.683-1.193 0-3.55 1.238-4.04 2.127-.245.477-.429.413-1.5-.603-1.99-1.873-4.592-2-6.245-.349l-.827.825-.306-.793c-.153-.445-.52-.89-.796-1.016-.918-.35-2.755-.19-3.459.317z"
                        fill="#9748FF"
                    />
                </Svg>
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderTherrLogo);
