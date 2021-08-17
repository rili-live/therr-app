import { StyleSheet } from 'react-native';
import * as therrTheme from '../themes';

interface IGetTypeAheadStyles {
    viewPortHeight: number;
}

const getTypeAheadStyles = ({
    viewPortHeight,
}: IGetTypeAheadStyles) => StyleSheet.create({
    container: {
        position: 'absolute',
        backgroundColor: therrTheme.colors.backgroundCream,
        zIndex: 1000,
        width: '100%',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        maxHeight: viewPortHeight - 400,
    },
    separator: {
        width: '100%',
        height: 1,
        backgroundColor: therrTheme.colors.backgroundNeutral,
    },
    itemContainer: {
        paddingHorizontal: 9,
        paddingVertical: 9,
    },
    itemText: {
        color: therrTheme.colors.textBlack,
    },
});

export default getTypeAheadStyles;
