import React from 'react';
import { View, Text, FlatList } from 'react-native';
import  { Button } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import therrIconConfig from '../../assets/therr-font-config.json';

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

const renderCategoryButton = (onCategoryPress, theme, themeCategory, themeForms) => {
    return ({
        item: category,
    }) => {
        const buttonStyle = category.isActive ? themeCategory.styles.categoryButtonActive : themeCategory.styles.categoryButton;
        const containerStyle = category.isActive ? themeCategory.styles.categoryButtonContainerActive : themeCategory.styles.categoryButtonContainer;
        const titleStyle = category.isActive ? themeCategory.styles.categoryButtonTitleActive : themeCategory.styles.categoryButtonTitle;

        return (
            <Button
                title={category.name}
                icon={renderCategoryIcon(category, theme, themeCategory)}
                onPress={() => onCategoryPress(category)}
                buttonStyle={[themeForms.styles.buttonPill, buttonStyle]}
                containerStyle={[themeForms.styles.buttonPillContainer, containerStyle]}
                titleStyle={[themeForms.styles.buttonPillTitle, titleStyle]}
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
    themeForms,
}) => {
    return (
        <View style={[themeCategory.styles.outerContainer, style]}>
            <View style={themeCategory.styles.innerContainer}>
                <Text style={[themeCategory.styles.header, { backgroundColor }]}>{translate('pages.groups.categories.title')}</Text>
                <FlatList
                    horizontal={true}
                    keyExtractor={keyExtractor}
                    data={categories}
                    renderItem={renderCategoryButton(onCategoryPress, theme, themeCategory, themeForms)}
                    contentContainerStyle={themeCategory.styles.listContainer}
                />
            </View>
            <Button
                containerStyle={[themeCategory.styles.listToggleButtonContainer, { backgroundColor }]}
                icon={
                    <TherrIcon
                        name={toggleChevronName}
                        size={16}
                        color={theme.colors.primary3}
                    />
                }
                onPress={onCategoryTogglePress}
                type="clear"
            />
        </View>
    );
};
