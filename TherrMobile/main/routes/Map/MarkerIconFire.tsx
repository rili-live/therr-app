/* eslint-disable max-len */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Material Design "local-fire-department" icon
export default function MarkerIconFire(props) {
    return (
        <Svg width={30} height={30} enableBackground="new 0 0 24 24" viewBox="0 0 24 24" {...props}>
            <Path fill="none" d="M0 0h24v24H0z" />
            <Path d="M12 12.9l-2.13 2.09C9.31 15.55 9 16.28 9 17.06 9 18.68 10.35 20 12 20s3-1.32 3-2.94c0-.78-.31-1.52-.87-2.07L12 12.9z" />
            <Path d="M16 6l-.44.55C14.38 8.02 12 7.19 12 5.3V2S4 7 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-2.96-1.61-5.62-4-7zm-4 16c-3.31 0-6-2.69-6-6 0-3.72 3.01-6.96 4.65-8.65C8.46 9.39 10.27 12.61 12 12.61c.58 0 1.13-.19 1.57-.53l.44-.35c1.55 1.17 2.99 3.01 2.99 5.27 0 3.31-2.69 6-6 6z" />
        </Svg>
    );
}
