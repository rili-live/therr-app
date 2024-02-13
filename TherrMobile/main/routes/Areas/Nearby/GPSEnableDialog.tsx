import React from 'react';
import { Text, View } from 'react-native';
import { Button } from 'react-native-elements';
import 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LottieView from 'lottie-react-native';
import earthLoader from '../../../assets/earth-loader.json';
import { ITherrThemeColors } from '../../../styles/themes';

interface IGpsEnableButtonDialogProps {
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => any;
    handleEnableLocationPress: () => any;
}

const GpsEnableButtonDialog = ({ handleEnableLocationPress, theme, themeForms, translate }: IGpsEnableButtonDialogProps) => {
    return (
        <KeyboardAwareScrollView
            contentInsetAdjustmentBehavior="automatic"
            style={theme.styles.bodyFlex}
            contentContainerStyle={theme.styles.bodyScrollTop}
        >
            <View style={[theme.styles.sectionContainer, { marginTop: 0 }]}>
                <View style={{ flex: 1, height: 100, marginBottom: 30 }}>
                    <LottieView
                        source={earthLoader}
                        // resizeMode="cover"
                        resizeMode="contain"
                        speed={1}
                        autoPlay
                        loop
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                    />
                </View>
                <Text style={theme.styles.sectionTitleCenter}>
                    {translate('pages.nearby.headerTitle')}
                </Text>
                <Text style={theme.styles.sectionDescriptionCentered}>
                    {translate('pages.nearby.locationDescription1')}
                </Text>
                {/* <Text style={theme.styles.sectionDescriptionCentered}>
                    {translate('pages.nearby.locationDescription2')}
                </Text> */}
                <Text style={[theme.styles.sectionDescriptionCentered]} />
                <Button
                    buttonStyle={themeForms.styles.button}
                    titleStyle={themeForms.styles.buttonTitle}
                    disabledTitleStyle={themeForms.styles.buttonTitleDisabled}
                    disabledStyle={themeForms.styles.buttonDisabled}
                    title={translate(
                        'forms.nearbyForm.buttons.enableLocation'
                    )}
                    onPress={() => handleEnableLocationPress()}
                    iconRight
                />
                <Text style={[theme.styles.sectionDescriptionCentered, { marginTop: 20 }]}>
                    {translate('pages.nearby.locationDescription3')}
                </Text>
            </View>
        </KeyboardAwareScrollView>
    );
};

export default GpsEnableButtonDialog;
