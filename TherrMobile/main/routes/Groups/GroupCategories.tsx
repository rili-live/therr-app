import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { Button } from '../../components/BaseButton';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import therrIconConfig from '../../assets/therr-font-config.json';
import spacingStyles from '../../styles/layouts/spacing';
import { getCategoryLabel } from './groupUtils';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const keyExtractor = (item) => item.iconId;

const renderCategoryIcon = (category, theme, themeButtons, themeCategory) => {
    const activeIconColor = themeCategory.styles.categoryIconActive.color;
    const style = {
        ...category.isActive ? themeButtons.styles.quickFiltersButtonIconActive : themeButtons.styles.quickFiltersButtonIcon,
        color: category.isActive ? activeIconColor : category.iconColor,
    };
    const props = {
        color: category.isActive ? activeIconColor : category.iconColor,
        name: category.iconId,
        size: 14,
        style,
        elevation: 1,
    };

    if (category.iconGroup === 'font-awesome-5') {
        return (<FontAwesome5Icon {...props} />);
    }

    if (category.iconGroup === 'therr') {
        return (<TherrIcon {...props} />);
    }

    return (<MaterialIcon {...props} />);
};

const renderCategoryButton = (onCategoryPress, theme, themeButtons, themeCategory, translate) => {
    return ({
        item: category,
    }) => {
        const buttonStyle = category.isActive
            ? [themeButtons.styles.quickFiltersButtonTinyActive, themeCategory.styles.categoryButtonActive]
            : [themeButtons.styles.quickFiltersButtonTiny, themeCategory.styles.categoryButton];
        const containerStyle = category.isActive ? themeCategory.styles.categoryButtonContainerActive : themeCategory.styles.categoryButtonContainer;
        const titleStyle = category.isActive
            ? [themeButtons.styles.quickFiltersButtonTitleActive, themeCategory.styles.categoryButtonTitleActive]
            : themeButtons.styles.quickFiltersButtonTitle;

        return (
            <Button
                title={getCategoryLabel(translate, category)}
                icon={renderCategoryIcon(category, theme, themeButtons, themeCategory)}
                iconContainerStyle={{
                    marginRight: 0,
                    paddingRight: 0,
                }}
                onPress={() => onCategoryPress(category)}
                buttonStyle={buttonStyle}
                containerStyle={[containerStyle, spacingStyles.marginVertSm, spacingStyles.marginHorizSm, {
                    height: themeButtons.styles.quickFiltersButtonTiny.height,
                }]}
                titleStyle={titleStyle}
            />
        );
    };
};

export default ({
    backgroundColor,
    categories,
    clearLabel,
    onCategoryPress,
    onCategoryTogglePress,
    style,
    toggleChevronName,
    translate,
    theme,
    themeCategory,
    themeButtons,
}: any) => {
    // With `clearLabel`, the corner button resets the filters, so it reads as a text "Clear" and only
    // shows while a filter is active. Without it (EditGroup), it is the chevron expand/collapse toggle.
    const isClearMode = !!clearLabel;
    const hasActiveFilter = (categories || []).some((c) => c.isActive);

    return (
        <View style={[themeCategory.styles.outerContainer, style]}>
            <View style={themeCategory.styles.innerContainer}>
                <Text style={[themeCategory.styles.header, { backgroundColor }]}>{translate('pages.groups.categories.title')}</Text>
                {
                    isClearMode
                        ? hasActiveFilter && (
                            <Button
                                containerStyle={[themeCategory.styles.listToggleButtonContainer, { backgroundColor }]}
                                buttonStyle={themeCategory.styles.listToggleButton}
                                title={clearLabel}
                                titleStyle={[themeCategory.styles.clearButtonTitle, { color: theme.colors.primary3 }]}
                                accessibilityLabel={clearLabel}
                                onPress={onCategoryTogglePress}
                                type="clear"
                            />
                        )
                        : (
                            <Button
                                containerStyle={[themeCategory.styles.listToggleButtonContainer, { backgroundColor }]}
                                buttonStyle={themeCategory.styles.listToggleButton}
                                icon={
                                    <TherrIcon
                                        name={toggleChevronName}
                                        size={18}
                                        color={theme.colors.primary3}
                                    />
                                }
                                onPress={onCategoryTogglePress}
                                type="clear"
                            />
                        )
                }
                <FlatList
                    horizontal={true}
                    keyExtractor={keyExtractor}
                    data={categories}
                    renderItem={renderCategoryButton(onCategoryPress, theme, themeButtons, themeCategory, translate)}
                    contentContainerStyle={themeCategory.styles.listContainer}
                    showsHorizontalScrollIndicator={false}
                />
            </View>
        </View>
    );
};
