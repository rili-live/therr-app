const getReadableDistance = (distanceInMiles: number) => {
    return distanceInMiles < 0.1
        ? `${Math.round(distanceInMiles * 5280)} ft`
        : `${Math.round(10 * distanceInMiles) / 10} mi`;
};

export default getReadableDistance;
