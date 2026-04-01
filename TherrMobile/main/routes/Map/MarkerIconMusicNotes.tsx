/* eslint-disable max-len */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Material Design "music-note" icon (matches Ionicons "musical-notes" in QuickReportSheet)
export default function MarkerIconMusicNotes(props) {
    return (
        <Svg width={30} height={30} enableBackground="new 0 0 24 24" viewBox="0 0 24 24" {...props}>
            <Path fill="none" d="M0 0h24v24H0z" />
            <Path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </Svg>
    );
}
