import React,{ useRef, useMemo, useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Easing } from 'react-native-reanimated';
import BottomSheet, { BottomSheetView, useBottomSheetTimingConfigs } from '@gorhom/bottom-sheet';
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

    // Gorhom defaults to a spring. Under Fabric + Android the spring
    // overshoot feels laggy; a short timing curve reaches the snap point
    // predictably in ~220ms without compromising the visual.
    const animationConfigs = useBottomSheetTimingConfigs({
        duration: 220,
        easing: Easing.out(Easing.cubic),
    });

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
        backgroundColor: themeBottomSheet.colors.backgroundWhite,
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
            animationConfigs={animationConfigs}
            containerStyle={localStyles.transparentBackground}
            handleStyle={localStyles.handle}
            handleIndicatorStyle={{}}
            backgroundStyle={backgroundStyle}
        >
            <BottomSheetView style={localStyles.sheetContent}>
                { children }
            </BottomSheetView>
        </BottomSheet>
    );
};

const localStyles = StyleSheet.create({
    transparentBackground: {
        backgroundColor: 'transparent',
    },
    handle: {
        height: 30,
    },
    sheetContent: {
        flex: 1,
        width: '100%',
    },
});

export default React.memo(BottomSheetPlus);
