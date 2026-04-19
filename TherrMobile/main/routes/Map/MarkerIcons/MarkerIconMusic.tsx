/* eslint-disable max-len */
import React from 'react';
import Svg, { Path, G, Rect } from 'react-native-svg';

export default function MarkerIconMusic(props) {
    return (
        <Svg width={30} height={30} viewBox="0 0 24 24" {...props}>
            <G>
                <Rect fill="none" height="30" width="30" />
            </G>
            <G>
                <Path
                    d="M12,3c-4.97,0-9,4.03-9,9v7c0,1.1,0.9,2,2,2h4v-8H5v-1c0-3.87,3.13-7,7-7s7,3.13,7,7v1h-4v8h4c1.1,0,2-0.9,2-2v-7 C21,7.03,16.97,3,12,3z M7,15v4H5v-4H7z M19,19h-2v-4h2V19z" />
            </G>
        </Svg>
    );
    // return (
    //     <Svg width={30} height={30} viewBox="0 0 24 24" {...props}>
    //         <Path
    //             d="M0 0h24v24H0V0z" fill="none"
    //         />
    //         <Path
    //             d="M12 3l.01 10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4.01 4S14 19.21 14 17V7h4V3h-6zm-1.99 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"
    //         />
    //     </Svg>
    // );
    // return (
    //     <Svg width={30} height={30} viewBox="0 0 512 512" {...props}>
    //         <Path
    //             d="M0 0h24v24H0V0z"
    //         />
    //         <Path
    //             d="M470.38 1.51L150.41 96A32 32 0 0 0 128 126.51v261.41A139 139 0 0 0 96 384c-53 0-96 28.66-96 64s43 64 96 64 96-28.66 96-64V214.32l256-75v184.61a138.4 138.4 0 0 0-32-3.93c-53 0-96 28.66-96 64s43 64 96 64 96-28.65 96-64V32a32 32 0 0 0-41.62-30.49z"
    //         />
    //     </Svg>
    // );
}
