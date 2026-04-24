import React from 'react';
import { Button } from './BaseButton';
import 'react-native-gesture-handler';
import TherrIcon from '../components/TherrIcon';
import getConfig from '../utilities/getConfig';

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
        const isMapEnabled = getConfig()?.featureFlags?.ENABLE_MAP === true;
        if (isAuthenticated && !isEmailVerifed) {
            navigation.navigate('CreateProfile');
            return;
        }
        if (isMapEnabled) {
            navigation.navigate('Map', isAuthenticated ? { shouldShowPreview: false } : undefined);
            return;
        }
        navigation.navigate('Home');
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
                    name="therr-logo"
                    size={26}
                    style={[logoStyle]}
                    onPress={handlePress}
                />
            }
        />
    );
};

export default React.memo(HeaderMenuLeft);
