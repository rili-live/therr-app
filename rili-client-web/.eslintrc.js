const path = require('path');

// .eslintrc.js
module.exports = {
    env: {
        browser: true,
        jest: true
    },
    extends: 'airbnb',
    parser: 'babel-eslint',
    rules: {
        "jsx-a11y/label-has-associated-control": [ 2, {
            "labelComponents": ["CustomInputLabel"],
            "labelAttributes": ["label"],
            "controlComponents": ["CustomInput"],
            "depth": 3,
        }],
        'react/jsx-indent': [2, 4],
        'react/jsx-indent-props': [2, 4],
        'react/sort-comp': [
            2,
            {
                order: [ 'static-methods', 'lifecycle', 'everything-else', 'render' ]
            }
        ],
        'indent': [2, 4, { SwitchCase: 1 }],
        'max-len': [2, { code: 140 }]
    },
    settings: {
        'import/resolver': {
            // NOTE: These aliases must match aliases in webpack.config.js
            alias: {
                map: [
                    ['rili-public-library/react-components/*', path.join(__dirname, '../rili-public-library/react-components/lib')],
                    ['rili-public-library/styles/*', path.join(__dirname, '../rili-public-library/styles/lib')],
                    ['rili-public-library/utilities/*', path.join(__dirname, '../rili-public-library/utilities/lib')],
                ],
                extensions: ['.js', '.jsx', '.json', '.scss']
            }
        }
    }
};