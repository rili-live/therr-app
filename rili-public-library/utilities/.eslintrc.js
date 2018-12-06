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
    }
};

