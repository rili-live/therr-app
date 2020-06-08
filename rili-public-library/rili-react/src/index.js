// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This allows tree-shaking

// Root level components
const miscellaneousComponents = [
    'components/index',
];

// Forms
const formComponents = [
    'components/forms/index',
];

// Routing
const routingComponents = [
    'components/routing/index',
];

// Redux
const redux = [
    'redux/actions/index',
    'redux/reducers/index',
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

module.exports = {
    components: miscellaneousComponents.concat(formComponents).concat(routingComponents),
    redux,
    services,
    types,
};
