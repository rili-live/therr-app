import React from 'react';
import { View, Text, FlatList } from 'react-native';
import  { Button } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import therrIconConfig from '../../assets/therr-font-config.json';
import spacingStyles from '../../styles/layouts/spacing';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const keyExtractor = (item) => item.iconId;

const renderCategoryIcon = (category, theme, themeCategory) => {
    const style = category.isActive ? themeCategory.styles.categoryIconActive : themeCategory.styles.categoryIcon;
    const props = {
        color: category.isActive ? category.iconColor : category.iconColor,
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

const renderCategoryButton = (onCategoryPress, theme, themeButtons, themeCategory) => {
    return ({
        item: category,
    }) => {
        const buttonStyle = category.isActive ? themeButtons.styles.quickFiltersButtonTinyActive : themeButtons.styles.quickFiltersButtonTiny;
        const containerStyle = category.isActive ? themeCategory.styles.categoryButtonContainerActive : themeCategory.styles.categoryButtonContainer;
        const titleStyle = category.isActive ? themeButtons.styles.quickFiltersButtonTitleActive : themeButtons.styles.quickFiltersButtonTitle;
        const titleCapped = category.name.charAt(0).toUpperCase() + category.name.slice(1);

        return (
            <Button
                title={titleCapped}
                icon={renderCategoryIcon(category, theme, themeCategory)}
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
    onCategoryPress,
    onCategoryTogglePress,
    style,
    toggleChevronName,
    translate,
    theme,
    themeCategory,
    themeButtons,
}) => {
    return (
        <View style={[themeCategory.styles.outerContainer, style]}>
            <View style={themeCategory.styles.innerContainer}>
                <Text style={[themeCategory.styles.header, { backgroundColor }]}>{translate('pages.groups.categories.title')}</Text>
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
                <FlatList
                    horizontal={true}
                    keyExtractor={keyExtractor}
                    data={categories}
                    renderItem={renderCategoryButton(onCategoryPress, theme, themeButtons, themeCategory)}
                    contentContainerStyle={themeCategory.styles.listContainer}
                    showsHorizontalScrollIndicator={false}
                />
            </View>
        </View>
    );
};
