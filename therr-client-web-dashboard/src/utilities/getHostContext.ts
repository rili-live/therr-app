const getBrandName = () => {
    if (typeof (window) !== 'undefined') {
        if (window?.location?.hostname === 'dashboard.appymeal.com') {
            return 'AppyMeal Analytics';
        }
    }

    return 'Therr for Business';
};

export {
    getBrandName,
};
