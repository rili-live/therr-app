import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';

interface ISearchThisAreaButtonGroupProps {
    handleSearchLocation?: any;
    translate: Function;
    themeButtons: {
        styles: any;
    };
}

export default ({
    handleSearchLocation,
    translate,
    themeButtons,
}: ISearchThisAreaButtonGroupProps) => {

    return (
        <View style={themeButtons.styles.buttonGroupTop}>
            <Button
                onPress={() => handleSearchLocation()}
                buttonStyle={themeButtons.styles.searchThisAreaButton}
                containerStyle={themeButtons.styles.btnContainer}
                titleStyle={themeButtons.styles.searchThisAreaTitle}
                title={translate('menus.searchThisArea.title')}
                raised
            />
        </View>
    );
};
