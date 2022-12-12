import React from 'react';
import { View } from 'react-native';
import { Badge } from 'react-native-elements';
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
            <View style={{ width: '100%', marginBottom: 10 }}>
                {
                    [filters.filtersCategory[0]].map((category) => (
                        <Badge
                            key={category.name}
                            value={category.title}
                            textStyle={[(category.isChecked ? themeForms.styles.buttonPillTitleInvert : themeForms.styles.buttonPillTitle), { fontSize: 15 }]}
                            badgeStyle={[
                                (category.isChecked ? themeForms.styles.buttonPillInvert : themeForms.styles.buttonPill),
                                { height: 25, width: '100%' },
                            ]}
                            containerStyle={[themeForms.styles.buttonPillContainer, spacingStyles.fullWidth]}
                            onPress={() => onPillPress('categoryFilters', 0, true)}
                        />
                    ))
                }
            </View>
            <View style={{ width: '100%', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-evenly' }}>
                {
                    filters.filtersCategory.slice(1, filters.filtersCategory.length).map((category, index) => (
                        <Badge
                            key={category.name}
                            value={category.title}
                            textStyle={[(category.isChecked ? themeForms.styles.buttonPillTitleInvert : themeForms.styles.buttonPillTitle), { fontSize: 14 }]}
                            badgeStyle={[
                                (category.isChecked ? themeForms.styles.buttonPillInvert : themeForms.styles.buttonPill),
                                { height: 25, width: '100%' },
                            ]}
                            containerStyle={themeForms.styles.buttonPillContainer}
                            onPress={() => onPillPress('categoryFilters', index + 1, false)}
                        />
                    ))
                }
            </View>
        </>
    );
};

export default React.memo(CategoryPills);
