const envIdsMap = {
    development: {
        superAdminId: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    },
    stage: {
        superAdminId: '04e65180-3cff-48b1-988f-4b6e0ab25def',
    },
    production: {
        superAdminId: '568bf5d2-8595-4fd6-95da-32cc318618d3',
    },
};

const SUPER_ADMIN_ID = envIdsMap[process.env.NODE_ENV || 'development'].superAdminId;

export {
    SUPER_ADMIN_ID,
};
