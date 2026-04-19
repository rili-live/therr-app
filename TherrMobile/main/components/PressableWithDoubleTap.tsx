import React, { useEffect, useRef } from 'react';
import {
    Pressable,
    StyleProp,
    ViewStyle,
} from 'react-native';

interface IPressableWithDoubleTapProps {
    children: React.ReactNode;
    style: StyleProp<ViewStyle>;
    delay?: number;
    onPress?: () => any;
    onDoubleTap: () => any;
}

const DoubleTap = ({
    children,
    style,
    delay = 250,
    onPress,
    onDoubleTap,
}: IPressableWithDoubleTapProps) => {
    const firstPressRef = useRef(true);
    const lastTimeRef = useRef(Date.now());
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
    }, []);

    const handleTap = () => {
        const now = Date.now();

        if (firstPressRef.current) {
            firstPressRef.current = false;
            timerRef.current = setTimeout(() => {
                onPress?.();
                firstPressRef.current = true;
                timerRef.current = null;
            }, delay);
            lastTimeRef.current = now;
        } else if (now - lastTimeRef.current < delay) {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            onDoubleTap?.();
            firstPressRef.current = true;
        }
    };

    return (
        <Pressable onPress={handleTap} style={style}>
            {children}
        </Pressable>
    );
};

export default DoubleTap;
