import React,{ useRef, useMemo, useCallback, useState } from 'react';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { BottomSheetMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { ITherrThemeColors } from '../../styles/themes';
import { buttonMenuHeight } from '../../styles/navigation/buttonMenu';

const defaultSnapPoints = [buttonMenuHeight + 28, '50%', '100%'];

interface IBottomSheetPlus {
    sheetRef: (sheetRef: React.RefObject<BottomSheetMethods>) => any;
    initialIndex?: number;
    onClose: () => any;
    children: React.ReactNode;
    themeBottomSheet: {
        colors: ITherrThemeColors;
        styles: any;
    };
}

const BottomSheetPlus = ({ children, sheetRef, initialIndex, onClose, themeBottomSheet }: IBottomSheetPlus) => {
    // ref
    const bottomSheetRef = useRef<BottomSheet>(null);
    sheetRef(bottomSheetRef);

    // variables
    const defaultBorderRadius = themeBottomSheet.styles.backgroundStyle.borderRadius;
    const snapPoints = useMemo(() => defaultSnapPoints, []);

    const [borderRadius, setBorderRadius] = useState(defaultBorderRadius);

    // callbacks
    const handleSheetChanges = useCallback((index: number) => {
        if (index === -1) {
            onClose();
        }
        if (index === defaultSnapPoints.length - 1) {
            setBorderRadius(0);
        } else {
            setBorderRadius(defaultBorderRadius);
        }
    }, [defaultBorderRadius, onClose]);

    return (
        <BottomSheet
            ref={bottomSheetRef}
            index={initialIndex || 0}
            enablePanDownToClose
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
            style={{}}
            containerStyle={{ backgroundColor: 'transparent' }}
            handleStyle={{ height: 30 }}
            handleIndicatorStyle={{}}
            backgroundStyle={{ borderRadius: borderRadius }}
        >
            <BottomSheetView style={{ flex: 1, width: '100%' }}>
                { children }
            </BottomSheetView>
        </BottomSheet>
    );
};

export default React.memo(BottomSheetPlus);
