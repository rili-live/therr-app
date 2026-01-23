import React from 'react';
import { View } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import Svg, { Path, G } from 'react-native-svg';
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
                <Svg width={75} height={25} x="0" y="0" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid meet">
                    <G transform="translate(0,400) scale(0.1,-0.1)" fill={theme.colors.accentLogo} stroke="none">
                        <Path d="M2711 3588 c-50 -297 -432 -3071 -434 -3162 -2 -57 -1 -59 26 -67 15
                            -4 168 -9 340 -11 l311 -3 101 729 100 729 120 79 c368 241 572 312 704 243
                            56 -29 66 -56 64 -180 -1 -119 -5 -148 -124 -1004 -43 -316 -77 -576 -75 -578
                            6 -6 399 -22 553 -23 l132 0 10 53 c6 28 44 293 86 587 176 1264 180 1317 107
                            1474 -62 133 -185 225 -353 266 -93 22 -234 26 -336 10 -234 -38 -498 -170
                            -757 -379 -49 -39 -91 -70 -93 -68 -2 2 8 51 22 108 49 205 200 1156 193 1217
                            -3 24 -8 28 -53 34 -27 3 -181 7 -341 7 l-292 1 -11 -62z"/>
                        <Path d="M995 3320 c-12 -4 -26 -14 -32 -21 -10 -13 -64 -360 -79 -512 -4 -38
                            -13 -74 -20 -81 -15 -15 -146 -33 -316 -42 -81 -5 -118 -10 -118 -19 0 -22
                            -50 -390 -56 -412 l-6 -23 216 0 c119 0 216 -2 216 -4 0 -3 -13 -87 -30 -188
                            -74 -461 -152 -1071 -153 -1198 0 -135 42 -263 115 -345 47 -55 145 -120 218
                            -147 62 -22 76 -23 335 -22 279 0 385 11 527 52 l61 17 -6 197 c-7 222 -14
                            249 -69 266 -18 6 -102 13 -186 16 -280 10 -296 27 -267 295 38 352 124 981
                            141 1025 3 8 13 18 22 22 9 5 143 11 297 14 301 6 314 8 335 60 5 14 19 93 31
                            175 36 260 36 231 -1 239 -18 3 -162 6 -321 6 -278 0 -289 1 -289 19 0 22 39
                            296 70 483 11 70 20 130 20 133 0 9 -634 4 -655 -5z"/>
                        <Path d="M6183 2730 c-278 -35 -589 -181 -719 -338 -244 -297 -382 -1033 -273
                            -1460 106 -417 358 -591 914 -632 270 -20 675 12 964 76 151 34 218 64 227
                            100 6 25 -7 220 -23 340 l-5 41 -562 7 c-324 4 -584 11 -615 17 -65 13 -137
                            75 -171 147 -21 44 -58 207 -49 216 2 2 155 18 339 36 642 61 823 93 988 176
                            113 57 180 115 242 211 73 111 85 169 85 408 0 181 -2 207 -23 274 -19 59 -34
                            85 -75 129 -98 104 -270 196 -412 221 -146 25 -710 46 -832 31z m581 -509 c69
                            -17 80 -38 85 -149 4 -134 -10 -193 -62 -247 -35 -36 -56 -47 -127 -68 -47
                            -14 -116 -30 -155 -36 -108 -17 -495 -61 -539 -61 l-39 0 7 38 c9 57 52 202
                            87 293 55 142 144 216 290 238 74 12 396 6 453 -8z"/>
                        <Path d="M9430 2694 c-466 -99 -809 -166 -880 -171 l-75 -6 -144 97 c-79 53
                            -149 95 -155 93 -6 -2 -21 -55 -34 -118 -48 -239 -386 -2238 -380 -2244 2 -2
                            156 0 343 5 187 5 356 9 376 10 l36 0 38 233 c121 757 181 1021 258 1144 59
                            93 186 176 318 208 35 8 145 20 244 26 99 5 184 14 189 19 15 15 116 646 116
                            726 0 32 -3 31 -250 -22z"/>
                        <Path d="M11210 2660 c-201 -44 -449 -96 -552 -117 -223 -44 -216 -45 -377 62
                            -101 67 -167 103 -175 94 -10 -11 -73 -372 -226 -1294 -94 -561 -172 -1030
                            -175 -1043 l-5 -22 373 0 374 0 11 52 c6 29 43 240 81 468 80 473 90 525 132
                            670 40 137 69 190 154 276 121 122 217 152 503 161 176 5 182 6 187 27 17 78
                            97 596 102 664 6 82 6 82 -18 81 -13 0 -188 -36 -389 -79z"/>
                    </G>
                </Svg>
            </View>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(HeaderTherrLogo);
