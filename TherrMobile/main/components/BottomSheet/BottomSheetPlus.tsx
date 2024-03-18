import React,{ useRef, useMemo, useCallback, useState } from 'react';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { ITherrThemeColors } from '../../styles/themes';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';

export const defaultSnapPoints = [buttonMenuHeight + 28, '50%', '100%'];

interface IBottomSheetPlus {
    sheetRef: (sheetRef: React.RefObject<BottomSheetMethods>) => any;
    initialIndex?: number;
    isTransparent: boolean;
    onClose: () => any;
    children: React.ReactNode;
    overrideSnapPoints?: (string | number)[];
    themeBottomSheet: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const BottomSheetPlus = ({
    children,
    sheetRef,
    initialIndex,
    isTransparent,
    onClose,
    overrideSnapPoints,
    themeBottomSheet,
}: IBottomSheetPlus) => {
    // ref
    const bottomSheetRef = useRef<BottomSheet>(null);
    sheetRef(bottomSheetRef);

    // variables
    const defaultBorderRadius = themeBottomSheet.styles.backgroundStyle.borderRadius;
    const initialSnapPoints = overrideSnapPoints || defaultSnapPoints;
    const snapPoints = useMemo(() => initialSnapPoints, [initialSnapPoints]);

    const [borderRadius, setBorderRadius] = useState(defaultBorderRadius);

    // callbacks
    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1) {
            onClose();
        }
        if (index === initialSnapPoints?.length - 1) {
            setBorderRadius(0);
        } else {
            setBorderRadius(defaultBorderRadius);
        }
    }, [defaultBorderRadius, initialSnapPoints, onClose]);

    const backgroundStyle: any = {
        borderRadius: borderRadius,
    };
    if (isTransparent) {
        backgroundStyle.backgroundColor = 'transparent';
    }

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={initialIndex || 0}
            enablePanDownToClose
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            containerStyle={{ backgroundColor: 'transparent' }}
            handleStyle={{ height: 30 }}
            handleIndicatorStyle={{}}
            backgroundStyle={backgroundStyle}
        >
            <BottomSheetView style={{ flex: 1, width: '100%' }}>
                { children }
            </BottomSheetView>
        </BottomSheet>
    );
};

export default React.memo(BottomSheetPlus);
