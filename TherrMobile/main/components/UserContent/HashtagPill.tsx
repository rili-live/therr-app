import React from 'react';
import { Button } from 'react-native-elements';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import formStyles from '../../styles/forms';

const renderIcon = (hasIcon) => {
    if (hasIcon) {
        return (
            <FontAwesome5Icon
                name="times"
                size={14}
                style={formStyles.buttonPillIcon}
            />
        );
    }

    return false;
};

export default ({ tag, onPress, hasIcon = true }) => {
    return (
        <Button
            buttonStyle={formStyles.buttonPill}
            containerStyle={formStyles.buttonPillContainer}
            titleStyle={formStyles.buttonPillTitle}
            title={`#${tag}`}
            icon={renderIcon(hasIcon)}
            iconRight={true}
            onPress={() => onPress(tag)}
        />
    );
};
