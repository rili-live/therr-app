// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This allows tree-shaking

// Root level components
const miscellaneousComponents = [
    'components/index',
    'components/mantine/index',
];

// Forms
const formComponents = [
    'components/forms/index',
];

// Routing
const routingComponents = [
    'components/routing/index',
];

// Constants
const constants = [
    'constants/index',
];

// Redux
const redux = [
    'redux/actions/index',
    'redux/reducers/index',
    'redux/persistConfig',
];

// Services
const services = [
    'services/index',
];

// Types
const types = [
    'types/index',
    'types/redux/index',
];

// Utilities
const utilities = [
    'utilities/cacheHelpers',
];

module.exports = {
    components: miscellaneousComponents.concat(formComponents).concat(routingComponents),
    constants,
    redux,
    services,
    types,
    utilities,
};
