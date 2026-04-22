import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { ITherrThemeColors } from '../styles/themes';
import spacingStyles from '../styles/layouts/spacing';

interface ICategoryPills {
    filters: {
        filtersAuthor: any[],
        filtersCategory: any[],
        filtersVisibility: any[],
    };
    onPillPress: (filterGroup: 'categoryFilters', index: number, isSelectAll?: boolean) => any;
    themeForms: {
        colors: ITherrThemeColors;
        styles: any;
    };
    translate: (key: string, params?: any) => string;
}

const CategoryPills = ({ filters, onPillPress, themeForms }: ICategoryPills) => {
    return (
        <>
            <View style={localStyles.allPillContainer}>
                {
                    [filters.filtersCategory[0]].map((category) => (
                        <Chip
                            key={category.name}
                            compact
                            mode={category.isChecked ? 'flat' : 'outlined'}
                            textStyle={[(category.isChecked ?
                                themeForms.styles.buttonPillTitleInvert
                                : themeForms.styles.buttonPillTitle), localStyles.allPillText]}
                            style={[
                                (category.isChecked ? themeForms.styles.buttonPillInvert : themeForms.styles.buttonPill),
                                themeForms.styles.buttonPillContainer,
                                spacingStyles.fullWidth,
                                { height: undefined },
                            ]}
                            onPress={() => onPillPress('categoryFilters', 0, true)}
                        >
                            {category.title}
                        </Chip>
                    ))
                }
            </View>
            <View style={localStyles.pillsRow}>
                {
                    filters.filtersCategory.slice(1, filters.filtersCategory.length).map((category, index) => (
                        <Chip
                            key={category.name}
                            compact
                            mode={category.isChecked ? 'flat' : 'outlined'}
                            textStyle={[(category.isChecked ?
                                themeForms.styles.buttonPillTitleInvert :
                                themeForms.styles.buttonPillTitle), localStyles.pillText]}
                            style={[
                                (category.isChecked ? themeForms.styles.buttonPillInvert : themeForms.styles.buttonPill),
                                themeForms.styles.buttonPillContainer,
                                { height: undefined },
                            ]}
                            onPress={() => onPillPress('categoryFilters', index + 1, false)}
                        >
                            {category.title}
                        </Chip>
                    ))
                }
            </View>
        </>
    );
};

const localStyles = StyleSheet.create({
    allPillContainer: {
        width: '100%',
        marginBottom: 10,
    },
    allPillText: {
        fontSize: 15,
    },
    pillsRow: {
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-evenly',
    },
    pillText: {
        fontSize: 14,
    },
});

export default React.memo(CategoryPills);
