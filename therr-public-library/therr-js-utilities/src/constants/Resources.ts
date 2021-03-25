const DefaultUserResources = {
    solar: 90,
    wind: 100,
    hydroElectric: 80,
    geoThermal: 50,
    ocean: 55,
    hydrogen: 65,
    bioMass: 30,
};

const ResourceExchangeRates = {
    createForum: {
        solar: 91,
        wind: 101,
        hydroElectric: 81,
        geoThermal: 51,
        ocean: 56,
        hydrogen: 66,
        bioMass: 31,
    },
    createMoment: {
        solar: 0,
        wind: 0,
        hydroElectric: 0,
        geoThermal: 0,
        ocean: 0,
        hydrogen: 0,
        bioMass: 0,
    },
};

export {
    DefaultUserResources,
    ResourceExchangeRates,
};
