import { Dimensions, StyleSheet } from 'react-native';
import { IMobileThemeName } from 'therr-react/types';
import { getTheme } from '../themes';

export const botSheetScrollViewHeight = 220;
export const botSheetScrollViewPad = 10;

const { height: viewPortHeight } = Dimensions.get('window');

// Height of a single map preview card. Owned here rather than in TherrMapView because
// the strip's container style (scrollViewOuterContainer) lives here too, and the map
// action buttons need the same number to lift clear of the strip in compact mode.
export const areaPreviewCardHeight = viewPortHeight / 4;

// Total vertical space the preview strip occupies measured up from the bottom edge:
// the card, the container's bottom inset, and the box-shadow padding.
export const areaPreviewStripFootprint = areaPreviewCardHeight + 23;


const buildStyles = (themeName?: IMobileThemeName) => {
    const therrTheme = getTheme(themeName);

    const styles = StyleSheet.create({
        backgroundStyle: {
            borderRadius: 9,
        },
        contentContainer: {
            flex: 1,
            alignItems: 'center',
        },
        scrollViewOuterContainer: {
            position: 'absolute',
            width: '100%',
            bottom: 10,
        },
        scrollViewContainer: {
            height: botSheetScrollViewHeight,
        },
        scrollView: {
            width: '100%',
            height: botSheetScrollViewHeight,
            paddingVertical: botSheetScrollViewPad,
        },
    });

    return ({
        ...therrTheme,
        styles,
    });
};

export {
    buildStyles,
};
