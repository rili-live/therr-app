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
    'redux/types/index',
];

// Services
const services = [
    'services/index',
];

module.exports = {
    components: miscellaneousComponents.concat(formComponents).concat(routingComponents),
    redux,
    services,
};
