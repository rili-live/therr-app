import React, { useEffect } from 'react';
import { useSpotlightTour } from 'react-native-spotlight-tour';

const TOUR_DELAY_MS = 10 * 1000;

const MapTourRenderer = ({
    getCurrentScreen,
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
            timeoutId = setTimeout(() => {
                updateTour({
                    isTouring: false,
                    isNavigationTouring: true,
                }, user?.details?.id);

                start();
            }, TOUR_DELAY_MS);
        } else {
            stop();
        }

        // Cleanup function
        return () => clearTimeout(timeoutId);
    }, [
        currentRouteName,
        start,
        stop,
        updateTour,
        user.details.id,
    ]);

    return <></>;
};

export default MapTourRenderer;
