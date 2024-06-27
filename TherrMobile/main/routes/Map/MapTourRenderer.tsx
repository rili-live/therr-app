import React, { useEffect } from 'react';
import { useSpotlightTour } from 'react-native-spotlight-tour';

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
        if (currentRouteName === 'Map') {
            updateTour({
                isTouring: false,
                isNavigationTouring: true,
            }, user.details.id);

            start();
        } else {
            stop();
        }
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
