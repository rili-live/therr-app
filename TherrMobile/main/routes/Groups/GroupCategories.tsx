import React from 'react';
import { FlatList, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import therrIconConfig from '../../assets/therr-font-config.json';
import { getCategoryLabel } from './groupUtils';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const ICON_SIZE = 15;

const keyExtractor = (item) => item.tag || item.iconId;

// Monochrome on purpose: the per-category icon colors clashed with each other and with the
// dark and retro surfaces. Category identity comes from the icon glyph and label.
const renderCategoryIcon = (category, color: string, style) => {
    if (category.isActive) {
        return <MaterialIcon name="check" size={ICON_SIZE + 1} color={color} style={style} />;
    }

    if (!category.iconId) {
        return null;
    }

    const props = {
        color,
        name: category.iconId,
        size: ICON_SIZE,
        style,
    };

    if (category.iconGroup === 'font-awesome-5') {
        return <FontAwesome5Icon {...props} />;
    }

    if (category.iconGroup === 'therr') {
        return <TherrIcon {...props} />;
    }

    return <MaterialIcon {...props} />;
};

const CategoryChip = ({ category, onPress, theme, themeCategory, translate }) => {
    const { styles } = themeCategory;
    const isActive = !!category.isActive;
    const label = getCategoryLabel(translate, category);
    const contentColor = isActive ? theme.colors.onBrand : theme.colors.onSurfaceMuted;

    return (
        <Pressable
            onPress={() => onPress(category)}
            style={({ pressed }) => [isActive ? styles.chipActive : styles.chip, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            hitSlop={{ top: 4, bottom: 4 }}
        >
            {renderCategoryIcon(category, contentColor, styles.chipIcon)}
            <Text style={isActive ? styles.chipLabelActive : styles.chipLabel} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
};

interface IGroupCategoriesProps {
    categories: any[];
    /** Shows a "Clear" action beside the header while any category is selected. */
    clearLabel?: string;
    /** Horizontal padding, so the header and chips line up with the content around them. */
    horizontalInset?: number;
    /** `scroll`: one horizontally scrolling row (a filter bar). `wrap`: every chip visible (a form field). */
    layout?: 'scroll' | 'wrap';
    onCategoryPress: (category: any) => void;
    onClearPress?: () => void;
    style?: StyleProp<ViewStyle>;
    theme: any;
    themeCategory: any;
    // Screens type their translator as `Function`; it is called as translate(key, params).
    translate: Function;
}

export default ({
    categories,
    clearLabel,
    horizontalInset = 16,
    layout = 'scroll',
    onCategoryPress,
    onClearPress,
    style,
    theme,
    themeCategory,
    translate,
}: IGroupCategoriesProps) => {
    const { styles } = themeCategory;
    const items = categories || [];
    const hasActiveFilter = items.some((c) => c.isActive);
    const showClear = !!clearLabel && !!onClearPress && hasActiveFilter;
    const insetStyle = { paddingHorizontal: horizontalInset };

    return (
        <View style={[styles.container, style]}>
            <View style={[styles.headerRow, insetStyle]}>
                <Text style={styles.header} accessibilityRole="header">
                    {translate('pages.groups.categories.title')}
                </Text>
                {
                    showClear && (
                        <Pressable
                            onPress={onClearPress}
                            style={({ pressed }) => [styles.clearButton, pressed && styles.chipPressed]}
                            accessibilityRole="button"
                            accessibilityLabel={clearLabel}
                            hitSlop={8}
                        >
                            <Text style={styles.clearButtonTitle}>{clearLabel}</Text>
                        </Pressable>
                    )
                }
            </View>
            {
                layout === 'wrap'
                    ? (
                        <View style={[styles.wrapList, insetStyle]}>
                            {
                                items.map((category) => (
                                    <CategoryChip
                                        key={keyExtractor(category)}
                                        category={category}
                                        onPress={onCategoryPress}
                                        theme={theme}
                                        themeCategory={themeCategory}
                                        translate={translate}
                                    />
                                ))
                            }
                        </View>
                    )
                    : (
                        <FlatList
                            horizontal
                            keyExtractor={keyExtractor}
                            data={items}
                            renderItem={({ item }) => (
                                <CategoryChip
                                    category={item}
                                    onPress={onCategoryPress}
                                    theme={theme}
                                    themeCategory={themeCategory}
                                    translate={translate}
                                />
                            )}
                            contentContainerStyle={[styles.scrollList, insetStyle]}
                            showsHorizontalScrollIndicator={false}
                        />
                    )
            }
        </View>
    );
};
