import React from 'react';
import { Button } from 'react-native-elements';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';

const renderIcon = (hasIcon, styles) => {
    if (hasIcon) {
        return (
            <FontAwesome5Icon
                name="times"
                size={14}
                style={styles.buttonPillIcon}
            />
        );
    }

    return false;
};

export default ({ tag, onPress, hasIcon = true, styles }) => {
    return (
        <Button
            buttonStyle={styles.buttonPill}
            containerStyle={styles.buttonPillContainer}
            titleStyle={styles.buttonPillTitle}
            title={`#${tag}`}
            icon={renderIcon(hasIcon, styles)}
            iconRight={true}
            onPress={() => onPress(tag)}
        />
    );
};
