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
                radius: 'sm',
            },
        },
        TextInput: {
            defaultProps: {
                size: 'md',
            },
        },
        Select: {
            defaultProps: {
                size: 'md',
            },
        },
        Checkbox: {
            defaultProps: {
                size: 'md',
            },
        },
    },
});

export default mantineTheme;
