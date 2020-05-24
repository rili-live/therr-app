// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This allows tree-shaking

// Root level components
const miscellaneousComponents = [
    'components/demo-page',
    'components/AccessControl',
    'components/ExampleComponent',
    'components/InlineSvg',
];

// Forms
const formComponents = [
    'components/forms/ButtonPrimary',
    'components/forms/ButtonSecondary',
    'components/forms/SvgButton',
    'components/forms/Input',
    'components/forms/RadioGroup',
    'components/forms/SearchBox',
    'components/forms/SelectBox',
];

// Routing
const routingComponents = [
    'components/routing/AuthRoute',
    'components/routing/Status',
    'components/routing/RedirectWithStatus',
];

// Redux
const redux = [
    'redux/actions/index',
    'redux/reducers/index',
    'redux/types/index',
];

module.exports = {
    components: miscellaneousComponents.concat(formComponents).concat(routingComponents),
    redux,
};
