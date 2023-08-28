import React from 'react';
import { SafeAreaView } from 'react-native';
import 'react-native-gesture-handler';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { IUserState } from 'therr-react/types';
// import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import { buildStyles } from '../../../styles';
import { buildStyles as buildMenuStyles } from '../../../styles/navigation/buttonMenu';
// import { buttonMenuHeightCompact } from '../../../styles/navigation/buttonMenu';
import translator from '../../../services/translator';
import MainButtonMenu from '../../../components/ButtonMenu/MainButtonMenu';
import BaseStatusBar from '../../../components/BaseStatusBar';
import NearbyWrapper from './NearbyWrapper';

interface INearbyDispatchProps {
    updateLocationDisclosure: Function;
    updateLocationPermissions: Function;
}

interface IStoreProps extends INearbyDispatchProps {
    user: IUserState;
}

// Regular component props
export interface INearbyProps extends IStoreProps {
    displaySize: 'small' | 'medium' | 'large';
    navigation: any;
    shouldHideNavbar: boolean;
    shouldDisableLocationSendEvent: boolean;
}

interface INearbyState {}

const mapStateToProps = (state: any) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) =>
    bindActionCreators(
        {},
        dispatch
    );

class Nearby extends React.Component<INearbyProps, INearbyState> {
    private carouselRef;
    private translate: (key: string, params?: any) => any;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.state = {};

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params?: any) =>
            translator('en-us', key, params);
    }

    componentDidMount() {
        const { navigation } = this.props;

        navigation.setOptions({
            title: this.translate('pages.nearby.headerTitle'),
        });
    }


    scrollTop = () => {
        this.carouselRef?.scrollToOffset({ animated: true, offset: 0 });
    };

    render() {
        const {
            displaySize,
            navigation,
            shouldDisableLocationSendEvent,
            shouldHideNavbar,
            user,
        } = this.props;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={[this.theme.styles.safeAreaView, { backgroundColor: this.theme.colorVariations.backgroundNeutral }]}>
                    <NearbyWrapper
                        carouselRef={(component) => this.carouselRef = component}
                        displaySize={displaySize}
                        navigation={navigation}
                        shouldHideNavbar={shouldHideNavbar}
                        shouldDisableLocationSendEvent={shouldDisableLocationSendEvent}
                    />
                </SafeAreaView>
                {
                    !shouldHideNavbar &&
                    <MainButtonMenu
                        activeRoute="Nearby"
                        navigation={navigation}
                        onActionButtonPress={this.scrollTop}
                        translate={this.translate}
                        user={user}
                        themeMenu={this.themeMenu}
                    />
                }
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Nearby);
