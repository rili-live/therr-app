import React from 'react';
import { Platform, SafeAreaView, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { CropView } from 'react-native-image-crop-tools';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import CropButtonMenu from '../../components/ButtonMenu/CropButtonMenu';
import translator from '../../services/translator';
import { buildStyles } from '../../styles';
import { buildStyles as buildMenuStyles } from '../../styles/navigation/buttonMenu';
import BaseStatusBar from '../../components/BaseStatusBar';


interface IAreaImageCropDispatchProps {
    createMoment: Function;
}

interface IStoreProps extends IAreaImageCropDispatchProps {
    user: IUserState;
}

// Regular component props
export interface IAreaImageCropProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface IAreaImageCropState {
    errorMsg: string;
    successMsg: string;
    isSubmitting: boolean;
}

const mapStateToProps = (state) => ({
    user: state.user,
});

const mapDispatchToProps = (dispatch: any) => bindActionCreators({
    createMoment: MapActions.createMoment,
}, dispatch);

export class AreaImageCrop extends React.Component<IAreaImageCropProps, IAreaImageCropState> {
    private cropViewRef;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;
    private theme = buildStyles();
    private themeMenu = buildMenuStyles();

    constructor(props) {
        super(props);

        this.state = {
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        };

        this.theme = buildStyles(props.user.settings?.mobileThemeName);
        this.themeMenu = buildMenuStyles(props.user.settings?.mobileThemeName);
        this.translate = (key: string, params: any) => translator('en-us', key, params);
        // changeNavigationBarColor(therrTheme.colors.accent1, false, true);
    }

    componentDidMount() {
        const { navigation } = this.props;
        navigation.setOptions({
            title: this.translate('pages.cropImage.headerTitle'),
        });
    }

    onActionButtonPress = (name) => {
        const { navigation } = this.props;

        if (name === 'rotate') {
            this.cropViewRef?.rotateImage(true);
        } else if (name === 'cancel') {
            navigation.navigate('Map');
        } else if (name === 'done') {
            const imageQualityPercent = 75;
            this.cropViewRef.saveImage(true, imageQualityPercent);
        }
    }

    onSubmit = (croppedImage) => {
        const {
            navigation,
            route,
        } = this.props;
        const {
            latitude,
            longitude,
        } = route.params;
        const { areaType, imageDetails } = route.params;
        const routeName = areaType === 'spaces' ? 'EditSpace' : 'EditMoment';

        return navigation.navigate(routeName, {
            latitude,
            longitude,
            imageDetails: {
                ...imageDetails,
                croppedImage,
            },
        });
    };

    render() {
        const { navigation, route, user } = this.props;
        const { imageDetails } = route.params;
        const localFilePath = Platform.OS === 'ios' ? imageDetails.uri?.replace('file:///', '') : imageDetails.uri;

        return (
            <>
                <BaseStatusBar therrThemeName={this.props.user.settings?.mobileThemeName}/>
                <SafeAreaView style={this.theme.styles.safeAreaView}>
                    <ScrollView
                        style={[this.theme.styles.bodyFlex, { padding: 0 }]} contentContainerStyle={[this.theme.styles.bodyScroll, { minHeight: '100%' }]}
                    >
                        <CropView
                            sourceUrl={localFilePath}
                            style={{
                                flex: 1,
                                padding: 0,
                                margin: 0,
                            }}
                            ref={(ref) => this.cropViewRef = ref}
                            onImageCrop={this.onSubmit}
                            keepAspectRatio
                            aspectRatio={{width: 1, height: 1}}
                        />
                    </ScrollView>
                </SafeAreaView>
                <CropButtonMenu
                    navigation={navigation}
                    translate={this.translate}
                    onActionButtonPress={this.onActionButtonPress}
                    user={user}
                    themeMenu={this.themeMenu}
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(AreaImageCrop);
