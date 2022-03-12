import React from 'react';
import Svg, { G, Rect, Path, Circle } from 'react-native-svg';

export default function MarkerIconFood(props) {
    return (
        <Svg width={30} height={30} enable-background="new 0 0 24 24"  viewBox="0 0 24 24" {...props}>
            <G>
                <Rect fill="none" height={24} width={24}/>
            </G>
            <G>
                <G>
                    <Path
                        d="M12.79,21L3,11.21v2c0,0.53,0.21,1.04,0.59,1.41l7.79,7.79c0.78,0.78,2.05,0.78,2.83,0l6.21-6.21 c0.78-0.78,0.78-2.05,0-2.83L12.79,21z"
                    />
                    <Path
                        // eslint-disable-next-line max-len
                        d="M11.38,17.41c0.39,0.39,0.9,0.59,1.41,0.59c0.51,0,1.02-0.2,1.41-0.59l6.21-6.21c0.78-0.78,0.78-2.05,0-2.83l-7.79-7.79 C12.25,0.21,11.74,0,11.21,0H5C3.9,0,3,0.9,3,2v6.21c0,0.53,0.21,1.04,0.59,1.41L11.38,17.41z M5,2h6.21L19,9.79L12.79,16L5,8.21 V2z"
                    />
                    <Circle cx="7.25" cy="4.25" r="1.25" />
                </G>
            </G>
        </Svg>
    );
}
