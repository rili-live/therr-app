import { createTheme, MantineColorsTuple } from '@mantine/core';

// Teal primary color palette (10 shades) based on #1C7F8A
const teal: MantineColorsTuple = [
    '#e6f5f7', // 0 - lightest
    '#c2e6ea', // 1
    '#9ad6dd', // 2
    '#6ec5cf', // 3
    '#48b7c3', // 4
    '#28a5b4', // 5 - mid
    '#1C7F8A', // 6 - base primary
    '#166872', // 7
    '#104B52', // 8 - dark
    '#0a3239', // 9 - darkest
];

// Shared input styles to match mobile app (52px tall, rounded)
const inputStyles = {
    input: {
        height: '3.25rem',
        minHeight: '3.25rem',
        borderRadius: '1rem',
        fontSize: '1rem',
    },
};

const mantineTheme = createTheme({
    primaryColor: 'teal',
    colors: {
        teal,
    },
    fontFamily: 'Lexend, sans-serif',
    headings: {
        fontFamily: 'Lexend, sans-serif',
    },
    components: {
        Button: {
            defaultProps: {
                radius: 'xl',
                size: 'lg',
            },
        },
        TextInput: {
            defaultProps: {
                size: 'md',
            },
            styles: inputStyles,
        },
        PasswordInput: {
            defaultProps: {
                size: 'md',
            },
            styles: {
                input: {
                    height: '3.25rem',
                    minHeight: '3.25rem',
                    borderRadius: '1rem',
                    fontSize: '1rem',
                },
                innerInput: {
                    height: '3.25rem',
                },
            },
        },
        Select: {
            defaultProps: {
                size: 'md',
            },
            styles: inputStyles,
        },
        Checkbox: {
            defaultProps: {
                size: 'md',
            },
        },
    },
});

export default mantineTheme;
