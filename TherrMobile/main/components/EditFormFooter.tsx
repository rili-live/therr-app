import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';

export interface IFooterButtonConfig {
    title: string;
    onPress: (...args: any[]) => void;
    mode: 'outlined' | 'contained';
    icon?: string;
    disabled?: boolean;
    buttonColor?: string;
    textColor?: string;
}

interface IEditFormFooterProps {
    buttons: IFooterButtonConfig[];
    isDarkMode: boolean;
    theme: any;
}

const EditFormFooter = ({ buttons, isDarkMode, theme }: IEditFormFooterProps) => {
    const dynamicStyles = {
        borderTopColor: isDarkMode ? theme.colors.accentDivider : theme.colors.tertiary,
        backgroundColor: theme.colors.primary,
    };

    return (
        <View style={[styles.footer, dynamicStyles]}>
            {buttons.map((button, index) => (
                <Pressable
                    key={index}
                    style={({ pressed }) => [
                        styles.buttonWrapper,
                        pressed && !button.disabled && styles.buttonPressed,
                    ]}
                    onPress={button.disabled ? undefined : button.onPress}
                >
                    <PaperButton
                        mode={button.mode}
                        icon={button.icon}
                        disabled={button.disabled}
                        buttonColor={button.buttonColor}
                        textColor={button.textColor}
                        style={styles.footerButton}
                    >
                        {button.title}
                    </PaperButton>
                </Pressable>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    buttonWrapper: {
        flex: 1,
        marginHorizontal: 6,
        justifyContent: 'center',
    },
    buttonPressed: {
        opacity: 0.7,
    },
    footerButton: {
        width: '100%',
    },
});

export default EditFormFooter;
