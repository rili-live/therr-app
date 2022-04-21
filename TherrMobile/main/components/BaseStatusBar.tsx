import React from 'react';
import { StatusBar } from 'react-native';

export default (props) => {
    let barStyle = 'light-content';
    if (props.therrThemeName === 'light') {
        barStyle = 'dark-content';
    }
    return <StatusBar barStyle={barStyle} animated={true} translucent={true} {...props} />;
};
