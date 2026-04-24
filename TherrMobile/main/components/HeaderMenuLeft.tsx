import React from 'react';
import { Button } from './BaseButton';
import 'react-native-gesture-handler';
import { BrandVariations } from 'therr-js-utilities/constants';
import TherrIcon from '../components/TherrIcon';
import { CURRENT_BRAND_VARIATION } from '../config/brandConfig';

const LOGO_GLYPH_NAME = CURRENT_BRAND_VARIATION === BrandVariations.HABITS
    ? 'cami-glyph'
    : 'therr-logo';

export interface IHeaderMenuLeftProps {
    isAuthenticated: boolean;
    isEmailVerifed: boolean;
    styleName: 'light' | 'dark' | 'accent';
    navigation: any;
    theme: {
        styles: any;
    };
}

const HeaderMenuLeft = ({
    isAuthenticated,
    isEmailVerifed,
    styleName,
    navigation,
    theme,
}: IHeaderMenuLeftProps) => {
    const handlePress = () => {
        if (isAuthenticated && isEmailVerifed) {
            navigation.navigate('Map', {
                shouldShowPreview: false,
            });
        } else if (isAuthenticated) {
            navigation.navigate('CreateProfile');
        } else {
            navigation.navigate('Map');
        }
    };

    let logoStyle = theme.styles.logoIcon;
    if (styleName === 'dark') {
        logoStyle = theme.styles.logoIconDark;
    } else if (styleName === 'accent') {
        logoStyle = theme.styles.logoIconBlack;
    }

    return (
        <Button
            type="clear"
            icon={
                <TherrIcon
                    name={LOGO_GLYPH_NAME}
                    size={26}
                    style={[logoStyle]}
                    onPress={handlePress}
                />
            }
        />
    );
};

export default React.memo(HeaderMenuLeft);
