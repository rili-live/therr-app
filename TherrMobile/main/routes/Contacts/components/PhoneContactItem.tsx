import { ITherrThemeColors } from '../../../styles/themes';
import React from 'react';
import { ListItem } from 'react-native-elements';
import 'react-native-gesture-handler';

interface IPhoneContactItemProps {
    contactDetails: any;
    onPress: any;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

const PhoneContactItem: React.FunctionComponent<IPhoneContactItemProps> = ({
    contactDetails,
    onPress,
    theme,
}) => {
    return (
        <ListItem
            onPress={() => onPress(contactDetails.recordID)}
            bottomDivider
            containerStyle={theme.styles.listItemCard}
        >
            <ListItem.Content>
                <ListItem.Title>{`${contactDetails.givenName} ${contactDetails.familyName}`}</ListItem.Title>
            </ListItem.Content>
            <ListItem.CheckBox
                checked={contactDetails.isChecked}
                onPress={() => onPress(contactDetails.recordID)}
                checkedColor={theme.colors.brandingBlueGreen}
            />
        </ListItem>
    );
};

export default PhoneContactItem;
