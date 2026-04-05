export interface ICityEntry {
    name: string;
    state: string;
    stateAbbr: string;
    slug: string;
    lat: number;
    lng: number;
}

const CitiesList: ICityEntry[] = [
    {
        name: 'New York', state: 'New York', stateAbbr: 'NY', slug: 'new-york-ny', lat: 40.7128, lng: -74.0060,
    },
    {
        name: 'Los Angeles', state: 'California', stateAbbr: 'CA', slug: 'los-angeles-ca', lat: 34.0522, lng: -118.2437,
    },
    {
        name: 'Chicago', state: 'Illinois', stateAbbr: 'IL', slug: 'chicago-il', lat: 41.8781, lng: -87.6298,
    },
    {
        name: 'Houston', state: 'Texas', stateAbbr: 'TX', slug: 'houston-tx', lat: 29.7604, lng: -95.3698,
    },
    {
        name: 'Phoenix', state: 'Arizona', stateAbbr: 'AZ', slug: 'phoenix-az', lat: 33.4484, lng: -112.0740,
    },
    {
        name: 'Philadelphia', state: 'Pennsylvania', stateAbbr: 'PA', slug: 'philadelphia-pa', lat: 39.9526, lng: -75.1652,
    },
    {
        name: 'San Antonio', state: 'Texas', stateAbbr: 'TX', slug: 'san-antonio-tx', lat: 29.4241, lng: -98.4936,
    },
    {
        name: 'San Diego', state: 'California', stateAbbr: 'CA', slug: 'san-diego-ca', lat: 32.7157, lng: -117.1611,
    },
    {
        name: 'Dallas', state: 'Texas', stateAbbr: 'TX', slug: 'dallas-tx', lat: 32.7767, lng: -96.7970,
    },
    {
        name: 'San Jose', state: 'California', stateAbbr: 'CA', slug: 'san-jose-ca', lat: 37.3382, lng: -121.8863,
    },
    {
        name: 'Austin', state: 'Texas', stateAbbr: 'TX', slug: 'austin-tx', lat: 30.2672, lng: -97.7431,
    },
    {
        name: 'Jacksonville', state: 'Florida', stateAbbr: 'FL', slug: 'jacksonville-fl', lat: 30.3322, lng: -81.6557,
    },
    {
        name: 'Fort Worth', state: 'Texas', stateAbbr: 'TX', slug: 'fort-worth-tx', lat: 32.7555, lng: -97.3308,
    },
    {
        name: 'Columbus', state: 'Ohio', stateAbbr: 'OH', slug: 'columbus-oh', lat: 39.9612, lng: -82.9988,
    },
    {
        name: 'Charlotte', state: 'North Carolina', stateAbbr: 'NC', slug: 'charlotte-nc', lat: 35.2271, lng: -80.8431,
    },
    {
        name: 'Indianapolis', state: 'Indiana', stateAbbr: 'IN', slug: 'indianapolis-in', lat: 39.7684, lng: -86.1581,
    },
    {
        name: 'San Francisco', state: 'California', stateAbbr: 'CA', slug: 'san-francisco-ca', lat: 37.7749, lng: -122.4194,
    },
    {
        name: 'Seattle', state: 'Washington', stateAbbr: 'WA', slug: 'seattle-wa', lat: 47.6062, lng: -122.3321,
    },
    {
        name: 'Denver', state: 'Colorado', stateAbbr: 'CO', slug: 'denver-co', lat: 39.7392, lng: -104.9903,
    },
    {
        name: 'Nashville', state: 'Tennessee', stateAbbr: 'TN', slug: 'nashville-tn', lat: 36.1627, lng: -86.7816,
    },
    {
        name: 'Oklahoma City', state: 'Oklahoma', stateAbbr: 'OK', slug: 'oklahoma-city-ok', lat: 35.4676, lng: -97.5164,
    },
    {
        name: 'El Paso', state: 'Texas', stateAbbr: 'TX', slug: 'el-paso-tx', lat: 31.7619, lng: -106.4850,
    },
    {
        name: 'Washington', state: 'District of Columbia', stateAbbr: 'DC', slug: 'washington-dc', lat: 38.9072, lng: -77.0369,
    },
    {
        name: 'Las Vegas', state: 'Nevada', stateAbbr: 'NV', slug: 'las-vegas-nv', lat: 36.1699, lng: -115.1398,
    },
    {
        name: 'Louisville', state: 'Kentucky', stateAbbr: 'KY', slug: 'louisville-ky', lat: 38.2527, lng: -85.7585,
    },
    {
        name: 'Memphis', state: 'Tennessee', stateAbbr: 'TN', slug: 'memphis-tn', lat: 35.1495, lng: -90.0490,
    },
    {
        name: 'Portland', state: 'Oregon', stateAbbr: 'OR', slug: 'portland-or', lat: 45.5051, lng: -122.6750,
    },
    {
        name: 'Baltimore', state: 'Maryland', stateAbbr: 'MD', slug: 'baltimore-md', lat: 39.2904, lng: -76.6122,
    },
    {
        name: 'Milwaukee', state: 'Wisconsin', stateAbbr: 'WI', slug: 'milwaukee-wi', lat: 43.0389, lng: -87.9065,
    },
    {
        name: 'Albuquerque', state: 'New Mexico', stateAbbr: 'NM', slug: 'albuquerque-nm', lat: 35.0844, lng: -106.6504,
    },
    {
        name: 'Tucson', state: 'Arizona', stateAbbr: 'AZ', slug: 'tucson-az', lat: 32.2226, lng: -110.9747,
    },
    {
        name: 'Fresno', state: 'California', stateAbbr: 'CA', slug: 'fresno-ca', lat: 36.7378, lng: -119.7871,
    },
    {
        name: 'Sacramento', state: 'California', stateAbbr: 'CA', slug: 'sacramento-ca', lat: 38.5816, lng: -121.4944,
    },
    {
        name: 'Mesa', state: 'Arizona', stateAbbr: 'AZ', slug: 'mesa-az', lat: 33.4152, lng: -111.8315,
    },
    {
        name: 'Kansas City', state: 'Missouri', stateAbbr: 'MO', slug: 'kansas-city-mo', lat: 39.0997, lng: -94.5786,
    },
    {
        name: 'Atlanta', state: 'Georgia', stateAbbr: 'GA', slug: 'atlanta-ga', lat: 33.7490, lng: -84.3880,
    },
    {
        name: 'Omaha', state: 'Nebraska', stateAbbr: 'NE', slug: 'omaha-ne', lat: 41.2565, lng: -95.9345,
    },
    {
        name: 'Colorado Springs', state: 'Colorado', stateAbbr: 'CO', slug: 'colorado-springs-co', lat: 38.8339, lng: -104.8214,
    },
    {
        name: 'Raleigh', state: 'North Carolina', stateAbbr: 'NC', slug: 'raleigh-nc', lat: 35.7796, lng: -78.6382,
    },
    {
        name: 'Long Beach', state: 'California', stateAbbr: 'CA', slug: 'long-beach-ca', lat: 33.7701, lng: -118.1937,
    },
    {
        name: 'Virginia Beach', state: 'Virginia', stateAbbr: 'VA', slug: 'virginia-beach-va', lat: 36.8529, lng: -75.9780,
    },
    {
        name: 'Minneapolis', state: 'Minnesota', stateAbbr: 'MN', slug: 'minneapolis-mn', lat: 44.9778, lng: -93.2650,
    },
    {
        name: 'Tampa', state: 'Florida', stateAbbr: 'FL', slug: 'tampa-fl', lat: 27.9506, lng: -82.4572,
    },
    {
        name: 'New Orleans', state: 'Louisiana', stateAbbr: 'LA', slug: 'new-orleans-la', lat: 29.9511, lng: -90.0715,
    },
    {
        name: 'Arlington', state: 'Texas', stateAbbr: 'TX', slug: 'arlington-tx', lat: 32.7357, lng: -97.1081,
    },
    {
        name: 'Bakersfield', state: 'California', stateAbbr: 'CA', slug: 'bakersfield-ca', lat: 35.3733, lng: -119.0187,
    },
    {
        name: 'Honolulu', state: 'Hawaii', stateAbbr: 'HI', slug: 'honolulu-hi', lat: 21.3069, lng: -157.8583,
    },
    {
        name: 'Anaheim', state: 'California', stateAbbr: 'CA', slug: 'anaheim-ca', lat: 33.8366, lng: -117.9143,
    },
    {
        name: 'Aurora', state: 'Colorado', stateAbbr: 'CO', slug: 'aurora-co', lat: 39.7294, lng: -104.8319,
    },
    {
        name: 'Santa Ana', state: 'California', stateAbbr: 'CA', slug: 'santa-ana-ca', lat: 33.7455, lng: -117.8677,
    },
];

// Lookup map: slug → city entry
const CitySlugMap: Record<string, ICityEntry> = {};
CitiesList.forEach((city) => {
    CitySlugMap[city.slug] = city;
});

export default { CitiesList, CitySlugMap };
