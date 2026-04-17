import React from 'react';
import { View } from 'react-native';
import { Button as PaperButton, Text as PaperText } from 'react-native-paper';
import 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import LottieView from 'lottie-react-native';
import earthLoader from '../../../assets/earth-loader.json';
import { ITherrThemeColors } from '../../../styles/themes';

interface IGpsEnableButtonDialogProps {
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => any;
    handleEnableLocationPress: () => any;
}

const GpsEnableButtonDialog = ({ handleEnableLocationPress, theme, translate }: IGpsEnableButtonDialogProps) => {
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
                <PaperText variant="headlineSmall" style={theme.styles.sectionTitleCenter}>
                    {translate('pages.nearby.headerTitle')}
                </PaperText>
                <PaperText variant="bodyMedium" style={theme.styles.sectionDescriptionCentered}>
                    {translate('pages.nearby.locationDescription1')}
                </PaperText>
                {/* <PaperText variant="bodyMedium" style={theme.styles.sectionDescriptionCentered}>
                    {translate('pages.nearby.locationDescription2')}
                </PaperText> */}
                <PaperText variant="bodyMedium" style={[theme.styles.sectionDescriptionCentered]} />
                <PaperButton
                    mode="contained"
                    onPress={() => handleEnableLocationPress()}
                    icon="crosshairs-gps"
                    buttonColor={theme.colors.brandingBlueGreen}
                    textColor={theme.colors.brandingWhite}
                >
                    {translate(
                        'forms.nearbyForm.buttons.enableLocation'
                    )}
                </PaperButton>
                <PaperText variant="bodyMedium" style={[theme.styles.sectionDescriptionCentered, { marginTop: 20 }]}>
                    {translate('pages.nearby.locationDescription3')}
                </PaperText>
            </View>
        </KeyboardAwareScrollView>
    );
};

export default GpsEnableButtonDialog;
