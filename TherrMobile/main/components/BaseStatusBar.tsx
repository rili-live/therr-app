import React from 'react';
import { StatusBar } from 'react-native';

export default (props) => {
    let barStyle = 'light-content';
    let backgroundColor = '#1E8A96';
    if (props.therrThemeName === 'light') {
        barStyle = 'dark-content';
        backgroundColor = '#ffffff';
    }
    return <StatusBar backgroundColor={backgroundColor} barStyle={barStyle} animated={true} translucent={true} {...props} />;
};
