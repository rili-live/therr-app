import React from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import { IMobileThemeName } from 'therr-react/types';

type Props = {
    therrThemeName?: IMobileThemeName;
};

// Maps the in-app theme name to the system-bar icon style.
// 'light' theme renders a light header → dark icons
// 'dark' theme renders a dark header → light icons
// 'retro' (and undefined) preserves prior behavior: light icons
const resolveStyle = (themeName?: IMobileThemeName): 'light' | 'dark' => {
    if (themeName === 'light') return 'dark';
    return 'light';
};

export default ({ therrThemeName }: Props) => (
    <SystemBars style={resolveStyle(therrThemeName)} />
);
