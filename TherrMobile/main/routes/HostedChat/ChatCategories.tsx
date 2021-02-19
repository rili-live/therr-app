import React from 'react';
import { View, Text, FlatList } from 'react-native';
import  { Button } from 'react-native-elements';
import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import therrIconConfig from '../../assets/therr-font-config.json';
import categoryStyles from '../../styles/hosted-chat/categories';
import formStyles from '../../styles/forms';
import * as therrTheme from '../../styles/themes';

const TherrIcon = createIconSetFromIcoMoon(
    therrIconConfig,
    'TherrFont',
    'TherrFont.ttf'
);

const keyExtractor = (item) => item.iconId;

const renderCategoryIcon = (category) => {
    const style = category.isActive ? categoryStyles.categoryIconActive : categoryStyles.categoryIcon;
    const props = {
        color: category.isActive ? therrTheme.colors.textWhite : category.iconColor,
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

const renderCategoryButton = (onCategoryPress) => {
    return ({
        item: category,
    }) => {
        const buttonStyle = category.isActive ? categoryStyles.categoryButtonActive : categoryStyles.categoryButton;
        const containerStyle = category.isActive ? categoryStyles.categoryButtonContainerActive : categoryStyles.categoryButtonContainer;
        const titleStyle = category.isActive ? categoryStyles.categoryButtonTitleActive : categoryStyles.categoryButtonTitle;

        return (
            <Button
                title={category.name}
                icon={renderCategoryIcon(category)}
                onPress={() => onCategoryPress(category)}
                buttonStyle={[formStyles.buttonPill, buttonStyle]}
                containerStyle={[formStyles.buttonPillContainer, containerStyle]}
                titleStyle={[formStyles.buttonPillTitle, titleStyle]}
            />
        );
    };
};

export default ({
    categories,
    onCategoryPress,
    onCategoryTogglePress,
    toggleChevronName,
    translate,
}) => {
    return (
        <View style={categoryStyles.outerContainer}>
            <View style={categoryStyles.innerContainer}>
                <Text style={categoryStyles.header}>{translate('pages.hostedChat.categories.title')}</Text>
                <FlatList
                    horizontal={true}
                    keyExtractor={keyExtractor}
                    data={categories}
                    renderItem={renderCategoryButton(onCategoryPress)}
                    contentContainerStyle={categoryStyles.listContainer}
                />
            </View>
            <Button
                containerStyle={categoryStyles.listToggleButtonContainer}
                icon={
                    <FontAwesome5Icon
                        name={toggleChevronName}
                        size={16}
                        color={therrTheme.colors.primary3}
                    />
                }
                onPress={onCategoryTogglePress}
                type="clear"
            />
        </View>
    );
};
