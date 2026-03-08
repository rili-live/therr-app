import React, { useEffect } from 'react';
import { useSpotlightTour } from 'react-native-spotlight-tour';

const TOUR_DELAY_MS = 10 * 1000;
const TOUR_IMMEDIATE_DELAY_MS = 300;

const MapTourRenderer = ({
    getCurrentScreen,
    immediate,
    navigation,
    updateTour,
    user,
}) => {
    const { start, stop } = useSpotlightTour();
    const currentRouteName = getCurrentScreen();

    useEffect(() => {
        //This useEffect acts as componentDidMount
        //It will only run once when the component mounts, since
        // the dependency array is empty
        let timeoutId;

        if (currentRouteName === 'Map') {
            const delayMs = immediate ? TOUR_IMMEDIATE_DELAY_MS : TOUR_DELAY_MS;
            timeoutId = setTimeout(() => {
                updateTour({
                    isTouring: false,
                    isNavigationTouring: true,
                }, user?.details?.id);

                if (immediate && navigation) {
                    navigation.setParams({ shouldStartNavigationTour: false });
                }

                start();
            }, delayMs);
        } else {
            stop();
        }

        // Cleanup function
        return () => clearTimeout(timeoutId);
    }, [
        currentRouteName,
        immediate,
        navigation,
        start,
        stop,
        updateTour,
        user.details.id,
    ]);

    return <></>;
};

export default MapTourRenderer;
