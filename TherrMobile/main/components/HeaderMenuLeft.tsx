import React from 'react';
import { Button } from './BaseButton';
import 'react-native-gesture-handler';
import TherrIcon from '../components/TherrIcon';

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
