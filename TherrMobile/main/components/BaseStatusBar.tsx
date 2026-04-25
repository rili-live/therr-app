import React from 'react';
import { SystemBars } from 'react-native-edge-to-edge';

type Props = {
    therrThemeName?: 'light' | 'dark' | 'retro' | string;
};

// Maps the in-app theme name to the system-bar icon style.
// 'light' theme renders a light header → dark icons
// 'dark' theme renders a dark header → light icons
// 'retro' (and any unknown) preserves prior behavior: light icons
const resolveStyle = (themeName?: string): 'light' | 'dark' => {
    if (themeName === 'light') return 'dark';
    return 'light';
};

export default ({ therrThemeName }: Props) => (
    <SystemBars style={resolveStyle(therrThemeName)} />
);
