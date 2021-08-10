import * as React from 'react';
import { View } from 'react-native';
import { Button } from 'react-native-elements';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import OctIcon from 'react-native-vector-icons/Octicons';
import buttonStyles from '../../styles/buttons';

export default ({
    areLayersVisible,
    layers,
    handleRefreshMoments,
    handleCreateMoment,
    handleCompassRealign,
    handleGpsRecenter,
    shouldFollowUserLocation,
    toggleLayer,
    toggleLayers,
    toggleMapFollow,
}) => {
    return (
        <>
            <View style={buttonStyles.toggleFollow}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name={shouldFollowUserLocation ? 'near-me' : 'navigation'}
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => toggleMapFollow()}
                />
            </View>
            <View style={buttonStyles.momentLayers}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name="layers"
                            size={44}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => toggleLayers()}
                />
            </View>
            {
                areLayersVisible &&
                <>
                    <View style={buttonStyles.momentLayerOption1}>
                        <Button
                            buttonStyle={buttonStyles.btn}
                            icon={
                                <FontAwesomeIcon
                                    name="globe"
                                    size={28}
                                    style={layers.connectionsMoments ? buttonStyles.btnIcon : buttonStyles.btnIconInactive}
                                />
                            }
                            raised={true}
                            onPress={() => toggleLayer('connectionsMoments')}
                        />
                    </View>
                    <View style={buttonStyles.momentLayerOption2}>
                        <Button
                            buttonStyle={buttonStyles.btn}
                            icon={
                                <FontAwesomeIcon
                                    name="child"
                                    size={28}
                                    style={layers.myMoments ? buttonStyles.btnIcon : buttonStyles.btnIconInactive}
                                />
                            }
                            raised={true}
                            onPress={() => toggleLayer('myMoments')}
                        />
                    </View>
                </>
            }
            <View style={buttonStyles.refreshMoments}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <FontAwesomeIcon
                            name="sync"
                            size={44}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={() => handleRefreshMoments(false)}
                />
            </View>
            <View style={buttonStyles.addMoment}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <OctIcon
                            name="device-camera"
                            size={44}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleCreateMoment}
                />
            </View>
            <View style={buttonStyles.compass}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <FontAwesomeIcon
                            name="compass"
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleCompassRealign}
                />
            </View>
            <View style={buttonStyles.recenter}>
                <Button
                    buttonStyle={buttonStyles.btn}
                    icon={
                        <MaterialIcon
                            name="gps-fixed"
                            size={28}
                            style={buttonStyles.btnIcon}
                        />
                    }
                    raised={true}
                    onPress={handleGpsRecenter}
                />
            </View>
        </>
    );
};
