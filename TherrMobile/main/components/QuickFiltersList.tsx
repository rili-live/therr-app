import * as React from 'react';
import { Button } from 'react-native-elements';
import { FlatList } from 'react-native';
import spacingStyles from '../styles/layouts/spacing';
import TherrIcon from './TherrIcon';


interface IQuickFiltersListProps {
    activeButtonId: string;
    filterButtons: {
        id: string;
        icon: string;
        title: string;
    }[];
    onSelect: any;
    translate: Function;
    themeButtons: {
        styles: any;
    };
}

const renderFilterButton = (item, props) => {
    const { activeButtonId, onSelect, themeButtons } = props;

    let onPress = () => onSelect(item.id);
    const buttonStyle = activeButtonId === item.id ? themeButtons.styles.quickFiltersButtonTinyActive : themeButtons.styles.quickFiltersButtonTiny;
    const buttonTitleStyle = activeButtonId === item.id ? themeButtons.styles.quickFiltersButtonTitleActive : themeButtons.styles.quickFiltersButtonTitle;
    const buttonIconStyle = activeButtonId === item.id ? themeButtons.styles.quickFiltersButtonIconActive : themeButtons.styles.quickFiltersButtonIcon;

    return (
        <Button
            containerStyle={[spacingStyles.marginVertSm, spacingStyles.marginHorizSm, {
                height: themeButtons.styles.quickFiltersButtonTiny.height,
            }]}
            buttonStyle={buttonStyle}
            // disabledTitleStyle={themeButtons.styles.buttonTitleDisabled}
            titleStyle={[buttonTitleStyle, { fontSize: 12 }]}
            title={item.title}
            onPress={onPress}
            raised={false}
            icon={
                item.icon && <TherrIcon
                    name={item.icon}
                    size={10}
                    style={buttonIconStyle}
                />
            }
        />
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
            renderItem={({ item }) => renderFilterButton(item, {
                activeButtonId,
                onSelect,
                themeButtons,
            })}
            keyExtractor={item => item.id}
            style={themeButtons.styles.buttonListTopContainer}
            contentContainerStyle={themeButtons.styles.buttonListTopContent}
            showsHorizontalScrollIndicator={false}
        />
    );
};

export default React.memo(QuickFiltersList);
