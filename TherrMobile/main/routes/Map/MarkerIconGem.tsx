/* eslint-disable max-len */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Material Design "auto-awesome" icon
export default function MarkerIconGem(props) {
    return (
        <Svg width={30} height={30} enableBackground="new 0 0 24 24" viewBox="0 0 24 24" {...props}>
            <Path fill="none" d="M0 0h24v24H0z" />
            <Path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
        </Svg>
    );
}
