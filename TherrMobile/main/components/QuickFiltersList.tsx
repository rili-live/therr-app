import * as React from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import spacingStyles from '../styles/layouts/spacing';
import TherrIcon from './TherrIcon';


interface IQuickFiltersListProps {
    activeButtonId: string;
    filterButtons: {
        index: string;
        icon: string;
        title: string;
    }[];
    onSelect: any;
    translate: Function;
    themeButtons: {
        colors: any;
        styles: any;
    };
}

const renderFilterButton = (item, props) => {
    const { activeButtonId, onSelect, themeButtons } = props;

    const onPress = () => onSelect(item.index);
    const isActive = activeButtonId === item.index;
    const bgColor = isActive ? themeButtons.colors.primary3 : themeButtons.colors.brandingWhite;
    const textColor = isActive ? themeButtons.colors.brandingWhite : themeButtons.colors.primary3;

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[spacingStyles.marginVertSm, spacingStyles.marginHorizSm]}
        >
            <View style={[
                themeButtons.styles.quickFiltersButtonTiny,
                { backgroundColor: bgColor },
            ]}>
                {!!item.icon && <TherrIcon
                    name={item.icon}
                    size={11}
                    color={textColor}
                />}
                <Text style={[
                    themeButtons.styles.quickFiltersButtonTitle,
                    { color: textColor },
                ]}>
                    {item.title}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const QuickFiltersList = ({
    activeButtonId,
    filterButtons,
    onSelect,
    themeButtons,
}: IQuickFiltersListProps) => {
    return (
        <FlatList
            horizontal
            data={filterButtons}
            extraData={activeButtonId}
            renderItem={({ item }) => renderFilterButton(item, {
                activeButtonId,
                onSelect,
                themeButtons,
            })}
            keyExtractor={item => item.index}
            style={themeButtons.styles.buttonListTopContainer}
            contentContainerStyle={themeButtons.styles.buttonListTopContent}
            showsHorizontalScrollIndicator={false}
        />
    );
};

export default React.memo(QuickFiltersList);
