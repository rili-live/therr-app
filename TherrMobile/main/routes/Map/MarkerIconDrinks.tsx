/* eslint-disable max-len */
import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export default function MarkerIconDrinks(props) {
    return (
        <Svg width={30} height={30} enableBackground="new 0 0 24 24"  viewBox="0 0 24 24" {...props}>
            <Rect fill="none" height={30} width={30} />
            <Path d="M6,3l0,6c0,2.97,2.16,5.43,5,5.91V19H8v2h8v-2h-3v-4.09c2.84-0.48,5-2.94,5-5.91V3H6z M12,13c-1.86,0-3.41-1.28-3.86-3h7.72 C15.41,11.72,13.86,13,12,13z M16,8H8l0-3h8L16,8z" />
        </Svg>
    );
}
