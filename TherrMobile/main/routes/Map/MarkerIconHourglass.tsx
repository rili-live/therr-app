/* eslint-disable max-len */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Material Design "hourglass-top" icon
export default function MarkerIconHourglass(props) {
    return (
        <Svg width={30} height={30} enableBackground="new 0 0 24 24" viewBox="0 0 24 24" {...props}>
            <Path fill="none" d="M0 0h24v24H0z" />
            <Path d="M6 2l.01 6L10 12l-3.99 4.01L6 22h12v-6l-4-4 4-3.99V2H6zm10 14.5V20H8v-3.5l4-4 4 4zm-4-5l-4-4V4h8v3.5l-4 4z" />
        </Svg>
    );
}
