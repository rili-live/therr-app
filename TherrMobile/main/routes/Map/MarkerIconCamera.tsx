import React from 'react';
import Svg, { Circle, Path, G } from 'react-native-svg';

export default function MarkerIconGeocache(props) {
    return (
        <Svg width={30} height={30} x="0" y="0" viewBox="0 0 307.308 307.308">
            <G id="_x31_1-DSLR_Camera">
                <Path
                    // eslint-disable-next-line max-len
                    d="M284.909,66.146h-81.345l-16.426-27.595c-1.607-2.698-4.514-4.351-7.654-4.351h-51.662c-3.14,0-6.048,1.653-7.654,4.351   l-16.426,27.595H77.049v-6.082c0-4.919-3.988-8.907-8.907-8.907H35.185c-4.92,0-8.907,3.988-8.907,8.907v6.082h-3.88   C10.027,66.146,0,76.174,0,88.543v162.166c0,12.37,10.027,22.398,22.397,22.398h262.512c12.37,0,22.398-10.028,22.398-22.398   V88.543C307.308,76.174,297.279,66.146,284.909,66.146z M153.653,233.379c-35.21,0-63.753-28.543-63.753-63.754   c0-35.209,28.543-63.753,63.753-63.753c35.21,0,63.753,28.544,63.753,63.753C217.406,204.836,188.863,233.379,153.653,233.379z    M270.935,112.322h-27.91c-4.919,0-8.907-3.988-8.907-8.908c0-4.92,3.988-8.908,8.907-8.908h27.91c4.921,0,8.908,3.988,8.908,8.908   C279.843,108.334,275.855,112.322,270.935,112.322z"
                    fill={props.fill}
                />
                <Circle cx="153.653" cy="169.625" r="44.538" fill={props.fillAlt}/>
            </G>
        </Svg>
    );
}
