import { ITherrThemeColors } from '../../../styles/themes';
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { ListItem } from '../../../components/BaseListItem';
import 'react-native-gesture-handler';
import { getContactDisplayName, getContactInviteTargetLabel } from '../../../utilities/inviteContacts';

interface IPhoneContactItemProps {
    contactDetails: any;
    isCheckable?: boolean;
    isActionDisabled?: boolean;
    onPress: any;
    onActionPress?: () => void;
    actionLabel?: string;
    theme: {
        colors: ITherrThemeColors;
        styles: any;
    }
}

const PhoneContactItem: React.FunctionComponent<IPhoneContactItemProps> = ({
    contactDetails,
    isCheckable,
    isActionDisabled,
    onPress,
    onActionPress,
    actionLabel,
    theme,
}) => {
    const handlePress = () => {
        if (isCheckable) {
            // For "not on app" contacts, tapping row toggles checkbox
            onPress(contactDetails.recordID);
        } else {
            // For "on app" contacts, tapping row navigates to profile
            onPress(contactDetails);
        }
    };

    // Shows which number/email the invite will actually go to, so a contact card with
    // several entries is not a guess.
    const inviteTarget = isCheckable ? getContactInviteTargetLabel(contactDetails) : '';

    return (
        <ListItem
            onPress={handlePress}
            bottomDivider
            containerStyle={theme.styles.listItemCard}
        >
            <ListItem.Content>
                <ListItem.Title numberOfLines={1}>{getContactDisplayName(contactDetails)}</ListItem.Title>
                {!!inviteTarget && <ListItem.Subtitle numberOfLines={1}>{inviteTarget}</ListItem.Subtitle>}
            </ListItem.Content>
            {isCheckable && (
                <ListItem.CheckBox
                    checked={contactDetails.isChecked}
                    onPress={() => onPress(contactDetails.recordID)}
                    checkedColor={theme.colors.brandingBlueGreen}
                />
            )}
            {onActionPress && (
                <TouchableOpacity
                    onPress={onActionPress}
                    disabled={isActionDisabled}
                    style={{
                        backgroundColor: isActionDisabled
                            ? theme.colors.textGray
                            : theme.colors.brandingBlueGreen,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 16,
                        marginLeft: isCheckable ? 8 : 0,
                    }}
                >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                        {actionLabel}
                    </Text>
                </TouchableOpacity>
            )}
        </ListItem>
    );
};

export default PhoneContactItem;
