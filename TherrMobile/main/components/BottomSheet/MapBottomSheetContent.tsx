import React from 'react';
import NearbyWrapper from '../../routes/Areas/Nearby/NearbyWrapper';
import { ITherrThemeColors } from '../../styles/themes';

interface IMapBottomSheetContent {
    navigation: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    },
    translate: Function;
}

const MapBottomSheetContent = ({
    navigation,
    // theme,
    // translate,
}: IMapBottomSheetContent) => {
    return (
        <>
            {/* <Text>{translate('pages.map.bottomSheet.noResults')}</Text> */}
            {/* TODO: Add a last element to prevent cuttoff of final item in scroll view */}
            <NearbyWrapper displaySize="medium" navigation={navigation} shouldDisableLocationSendEvent />
        </>
    );
};

export default React.memo(MapBottomSheetContent);
