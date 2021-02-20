import React from 'react';
import { Button } from 'react-native-elements';
import FontAwesome5Icon from 'react-native-vector-icons/FontAwesome5';
import formStyles from '../../styles/forms';

export default ({ tag, onPress }) =>{
    return (
        <Button
            buttonStyle={formStyles.buttonPill}
            containerStyle={formStyles.buttonPillContainer}
            titleStyle={formStyles.buttonPillTitle}
            title={`#${tag}`}
            icon={
                <FontAwesome5Icon
                    name="times"
                    size={14}
                    style={formStyles.buttonPillIcon}
                />
            }
            iconRight={true}
            onPress={() => onPress(tag)}
        />
    );
};
