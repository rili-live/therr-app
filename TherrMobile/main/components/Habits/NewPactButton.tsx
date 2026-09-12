import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { ITherrThemeColors } from '../../styles/themes';

interface INewPactButtonProps {
    onPress: () => void;
    themeHabits: { colors: ITherrThemeColors; styles: any };
    translate: (key: string, params?: any) => string;
}

/**
 * Floating "New Pact" action shared by the habits dashboard and the pacts list.
 *
 * Both screens previously had no create affordance of their own: the only ways
 * into the invite wizard were `PactPreviewOverlay` (which stops rendering as
 * soon as `activePacts` is non-empty) and the "Invite Someone Else" link inside
 * a Sent-tab invite card (which only exists while an invite is outstanding). A
 * user whose first pact went active therefore had no route back to the wizard.
 */
const NewPactButton: React.FC<INewPactButtonProps> = ({
    onPress,
    themeHabits,
    translate,
}) => (
    // `box-none` so the absolutely-positioned container never swallows touches
    // meant for the list scrolling underneath it.
    <View style={themeHabits.styles.newPactFabContainer} pointerEvents="box-none">
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={translate('pages.pacts.createPactAccessibility')}
            onPress={onPress}
            style={({ pressed }) => [
                themeHabits.styles.newPactFab,
                pressed && themeHabits.styles.pressedOpacity,
            ]}
        >
            <MaterialIcon
                name="add"
                size={22}
                style={themeHabits.styles.newPactFabIcon}
            />
            <Text style={themeHabits.styles.newPactFabLabel}>
                {translate('pages.pacts.createPact')}
            </Text>
        </Pressable>
    </View>
);

export default NewPactButton;
