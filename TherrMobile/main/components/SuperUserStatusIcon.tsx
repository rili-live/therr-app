import React from 'react';
import TherrIcon from './TherrIcon';
import {
    logoStyles,
} from '../styles/index';
import {
    colors,
} from '../styles/themes/retro/colors';
import { StyleProp, ViewStyle } from 'react-native';

interface ISuperUserStatusIcon {
    isSuperUser: boolean | undefined;
    isDarkMode: boolean;
    size: number;
    style?: StyleProp<ViewStyle>
}

const SuperUserStatusIcon = ({
    isSuperUser,
    isDarkMode,
    size,
    style,
}: ISuperUserStatusIcon) => {
    if (!isSuperUser) {
        return null;
    }

    let logoStyle: any = {
        ...logoStyles,
    };

    if (isDarkMode) {
        logoStyle.color = colors.brandingWhite;
    } else {
        logoStyle.color = colors.brandingBlueGreen;
    }

    return (
        <TherrIcon
            name="hand-heart"
            size={size}
            style={[
                style,
                logoStyle,
            ]}
        />
    );
};

export default SuperUserStatusIcon;
