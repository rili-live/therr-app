import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import buttonStyles from '../styles/buttons';

interface IFiltersButtonGroupProps {
    areLayersVisible: boolean;
    goToMap?: any;
    goToMoments?: any;
    layers: any;
    toggleLayer: Function;
    toggleLayers: Function;
    translate: Function;
}

export default ({
    areLayersVisible,
    goToMap,
    goToMoments,
    layers,
    toggleLayer,
    toggleLayers,
    translate,
}: IFiltersButtonGroupProps) => {
    if (!goToMap && !goToMoments) {
        throw new Error('At least one of goToMap or goToMoments function is required');
    }

    return (
        <>
            {
                areLayersVisible &&
                <View style={buttonStyles.buttonGroupFilterList}>
                    <View style={buttonStyles.momentLayerOption3}>
                        <Button
                            buttonStyle={buttonStyles.btnMedium}
                            icon={
                                <FontAwesomeIcon
                                    name="globe"
                                    size={30}
                                    style={layers.connectionsMoments ? buttonStyles.btnIcon : buttonStyles.btnIconInactive}
                                />
                            }
                            raised={true}
                            onPress={() => toggleLayer('connectionsMoments')}
                        />
                    </View>
                    <View style={buttonStyles.momentLayerOption4}>
                        <Button
                            buttonStyle={buttonStyles.btnMedium}
                            icon={
                                <FontAwesomeIcon
                                    name="child"
                                    size={30}
                                    style={layers.myMoments ? buttonStyles.btnIcon : buttonStyles.btnIconInactive}
                                />
                            }
                            raised={true}
                            onPress={() => toggleLayer('myMoments')}
                        />
                    </View>
                </View>
            }
            <View style={buttonStyles.buttonGroup}>
                <View style={buttonStyles.buttonGroupContainer}>
                    <Button
                        buttonStyle={buttonStyles.searchFiltersButton}
                        containerStyle={buttonStyles.btnGroupButtonContainer}
                        titleStyle={buttonStyles.searchFiltersTitle}
                        title={translate('menus.filters.title')}
                        icon={
                            <MaterialIcon
                                name="tune"
                                size={23}
                                style={buttonStyles.btnIconWhite}
                            />
                        }
                        onPress={() => toggleLayers()}
                    />
                </View>
            </View>
        </>
    );
};
