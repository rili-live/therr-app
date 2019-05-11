// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This allows tree-shaking

// Root level components
const componentList = ['demo-page', 'ExampleComponent', 'InlineSvg'];

// Forms
const formComponents = [
    'forms/ButtonPrimary',
    'forms/ButtonSecondary',
    'forms/SvgButton',
    'forms/Input',
    'forms/RadioGroup',
    'forms/SearchBox',
    'forms/SelectBox',
];

// Routing
const routingComponents = [
    'routing/Status',
    'routing/RedirectWithStatus',
];

module.exports = componentList.concat(formComponents).concat(routingComponents);
