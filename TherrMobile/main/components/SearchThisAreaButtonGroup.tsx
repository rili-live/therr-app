import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import buttonStyles from '../styles/buttons';

interface ISearchThisAreaButtonGroupProps {
    handleSearchLocation?: any;
    translate: Function;
}

export default ({
    handleSearchLocation,
    translate,
}: ISearchThisAreaButtonGroupProps) => {

    return (
        <View style={buttonStyles.buttonGroupTop}>
            <View style={buttonStyles.buttonGroupContainer}>
                <Button
                    onPress={() => handleSearchLocation()}
                    buttonStyle={buttonStyles.searchThisAreaButton}
                    containerStyle={buttonStyles.btnGroupButtonContainer}
                    titleStyle={buttonStyles.searchThisAreaTitle}
                    title={translate('menus.searchThisArea.title')}
                />
            </View>
        </View>
    );
};
