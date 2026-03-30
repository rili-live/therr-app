import React from 'react';
import NearbyWrapper from '../../routes/Areas/Nearby/NearbyWrapper';
import QuickReportSheet from '../../routes/Map/QuickReportSheet';
import { ITherrThemeColors } from '../../styles/themes';

export type IMapSheetContentTypes = 'nearby' | 'areas' | 'quick-report';

interface IMapBottomSheetContent {
    circleCenter?: { latitude: number; longitude: number };
    contentType: IMapSheetContentTypes;
    createMoment?: (data: any) => Promise<any>;
    navigation: any;
    nearbySpaces?: { id: string; title: string }[];
    onClose?: () => void;
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
    circleCenter,
    contentType,
    createMoment,
    navigation,
    nearbySpaces,
    onClose,
    theme,
    translate,
}: IMapBottomSheetContent) => {
    if (contentType === 'quick-report' && circleCenter && createMoment) {
        return (
            <QuickReportSheet
                circleCenter={circleCenter}
                createMoment={createMoment}
                nearbySpaces={nearbySpaces || []}
                onClose={onClose}
                translate={translate}
                theme={theme}
            />
        );
    }

    return (
        <>
            {/* TODO: Add a last element to prevent cuttoff of final item in scroll view */}
            <NearbyWrapper isInMapView displaySize="medium" navigation={navigation} shouldDisableLocationSendEvent />
        </>
    );
};

export default React.memo(MapBottomSheetContent);
