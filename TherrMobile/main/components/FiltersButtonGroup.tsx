import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';

interface IFiltersButtonGroupProps {
    areLayersVisible: boolean;
    goToMap?: any;
    goToMoments?: any;
    layers: any;
    toggleLayer: Function;
    toggleLayers: Function;
    translate: Function;
    themeButtons: {
        styles: any;
    }
}

export default ({
    areLayersVisible,
    goToMap,
    goToMoments,
    layers,
    toggleLayer,
    toggleLayers,
    translate,
    themeButtons,
}: IFiltersButtonGroupProps) => {
    if (!goToMap && !goToMoments) {
        throw new Error('At least one of goToMap or goToMoments function is required');
    }

    return (
        <>
            {
                areLayersVisible &&
                <View style={themeButtons.styles.buttonGroupFilterList}>
                    <View style={themeButtons.styles.momentLayerOption3}>
                        <Button
                            buttonStyle={themeButtons.styles.btnMedium}
                            titleStyle={themeButtons.styles.btnTextWhite}
                            icon={
                                <FontAwesomeIcon
                                    name="globe"
                                    size={themeButtons.styles.btnMedium.height}
                                    style={layers.connectionsMoments ? themeButtons.styles.btnIcon : themeButtons.styles.btnIconInactive}
                                />
                            }
                            raised={true}
                            onPress={() => toggleLayer('connectionsMoments')}
                        />
                    </View>
                    <View style={themeButtons.styles.momentLayerOption4}>
                        <Button
                            buttonStyle={themeButtons.styles.btnMedium}
                            icon={
                                <FontAwesomeIcon
                                    name="child"
                                    size={themeButtons.styles.btnMedium.height}
                                    style={layers.myMoments ? themeButtons.styles.btnIcon : themeButtons.styles.btnIconInactive}
                                />
                            }
                            raised={true}
                            onPress={() => toggleLayer('myMoments')}
                        />
                    </View>
                </View>
            }
            <View style={themeButtons.styles.buttonGroup}>
                <View style={themeButtons.styles.buttonGroupContainer}>
                    <Button
                        buttonStyle={themeButtons.styles.searchFiltersButton}
                        containerStyle={themeButtons.styles.btnGroupButtonContainer}
                        titleStyle={themeButtons.styles.searchFiltersTitle}
                        title={translate('menus.filters.title')}
                        icon={
                            <MaterialIcon
                                name="tune"
                                size={23}
                                style={themeButtons.styles.btnIconWhite}
                            />
                        }
                        onPress={() => toggleLayers()}
                    />
                </View>
            </View>
        </>
    );
};
