import * as React from 'react';
import { Text, View } from 'react-native';

export default ({
    password,
    translate,
    themeForms,
}) => {
    const passwordRequirements1 = translate('pages.register.passwordRequirements1');
    const passwordRequirements2 = translate('pages.register.passwordRequirements2');
    const passwordRequirements3 = translate('pages.register.passwordRequirements3');
    const passwordRequirements4 = translate('pages.register.passwordRequirements4');
    const p1Bullet = /([0-9]+[a-z]|[a-z]+[0-9])/i.test(password) ? '✓' : '*';
    const p2Bullet = /[A-Z]/.test(password) ? '✓' : '*';
    const p3Bullet = /[!@#$%^&*]/.test(password) ? '✓' : '*';
    const p4Bullet = password?.length >= 8 ? '✓' : '*';

    return (
        <View style={themeForms.styles.textField}>
            <Text style={themeForms.styles.textFieldInfoTextHeader}>
                Password Requirements
            </Text>
            <Text style={themeForms.styles.textFieldInfoText}>
                {`${p1Bullet} ${passwordRequirements1}`}
            </Text>
            <Text style={themeForms.styles.textFieldInfoText}>
                {`${p2Bullet} ${passwordRequirements2}`}
            </Text>
            <Text style={themeForms.styles.textFieldInfoText}>
                {`${p3Bullet} ${passwordRequirements3}`}
            </Text>
            <Text style={themeForms.styles.textFieldInfoText}>
                {`${p4Bullet} ${passwordRequirements4}`}
            </Text>
        </View>
    );
};
