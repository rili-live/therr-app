import React from 'react';
import { Platform, SafeAreaView, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { CropView } from 'react-native-image-crop-tools';
// import changeNavigationBarColor from 'react-native-navigation-bar-color';
import { IUserState } from 'therr-react/types';
import { MapActions } from 'therr-react/redux/actions';
import CropButtonMenu from '../components/ButtonMenu/CropButtonMenu';
import translator from '../services/translator';
import styles from '../styles';
import BaseStatusBar from '../components/BaseStatusBar';

interface ICropImageDispatchProps {
    createMoment: Function;
}

interface IStoreProps extends ICropImageDispatchProps {
    user: IUserState;
}

// Regular component props
export interface ICropImageProps extends IStoreProps {
    navigation: any;
    route: any;
}

interface ICropImageState {
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

export class CropImage extends React.Component<ICropImageProps, ICropImageState> {
    private cropViewRef;
    private scrollViewRef;
    private translate: Function;
    private unsubscribeNavListener;

    constructor(props) {
        super(props);

        this.state = {
            errorMsg: '',
            successMsg: '',
            isSubmitting: false,
        };

        this.translate = (key: string, params: any) => translator('en-us', key, params);
        // changeNavigationBarColor(therrTheme.colors.beemo1, false, true);
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
        const { imageDetails } = route.params;

        // TODO: Pass in cropped image
        return navigation.navigate('EditMoment', {
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
        const localFilePath = Platform.OS === 'ios' ? imageDetails.uri.replace('file:///', '') : imageDetails.uri;

        return (
            <>
                <BaseStatusBar />
                <SafeAreaView style={styles.safeAreaView}>
                    <ScrollView style={[styles.bodyFlex, { padding: 0 }]} contentContainerStyle={[styles.bodyScroll, { minHeight: '100%' }]}>
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
                />
            </>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CropImage);
