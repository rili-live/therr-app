import React from 'react';
import NearbyWrapper from '../../routes/Areas/Nearby/NearbyWrapper';
import { ITherrThemeColors } from '../../styles/themes';

export type IMapSheetContentTypes = 'nearby' | 'areas';

interface IMapBottomSheetContent {
    contentType: IMapSheetContentTypes;
    navigation: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    },
    themeBottomSheet: {
        styles: any;
    },
    themeViewArea: {
        styles: any;
    },
    translate: Function;
}

const MapBottomSheetContent = ({
    navigation,
}: IMapBottomSheetContent) => {
    // if (contentType !== 'nearby') {
    // }

    return (
        <>
            {/* <Text>{translate('pages.map.bottomSheet.noResults')}</Text> */}
            {/* TODO: Add a last element to prevent cuttoff of final item in scroll view */}
            <NearbyWrapper isInMapView displaySize="medium" navigation={navigation} shouldDisableLocationSendEvent />
        </>
    );
};

export default React.memo(MapBottomSheetContent);
