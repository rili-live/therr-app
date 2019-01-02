// NOTE: Only the utility filenames listed here will be available from the final build in `/lib`
// This allows tree-shaking

// Root level components
const componentList = ['demo-page', 'example-component'];

// Forms
const formComponents = [
    'forms/button-primary',
    'forms/button-secondary',
    'forms/input',
    'forms/radio-group',
    'forms/search-box',
    'forms/select-box',
];

module.exports = componentList.concat(formComponents);
