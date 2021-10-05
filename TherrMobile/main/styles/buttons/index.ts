import { StyleSheet } from 'react-native';
import { buttonMenuHeight } from '../navigation/buttonMenu';
import * as therrTheme from '../themes';

const collapseOffset = 20;

const btnStyles: any = {
    borderRadius: 100,
    padding: 1,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
};

const btnIconStyle: any = {
    color: therrTheme.colors.ternary,
    padding: 0,
};

const btnGroupBtnStyles: any = {
    padding: 4,
    borderWidth: 0,
    backgroundColor: therrTheme.colors.beemo1,
    borderRadius: 0,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

const bottomLeftBtnViewStyles: any = {
    position: 'absolute',
    left: 18,
    bottom: 60 + buttonMenuHeight - collapseOffset,
    shadowColor: therrTheme.colors.textBlack,
    shadowOffset: {
        height: 1,
        width: 1,
    },
    shadowRadius: 4,
    borderRadius: 100,
    padding: 0,
};
const leftSmallButton1ViewStyles: any = {
    position: 'absolute',
    left: 18,
    bottom: 106 + buttonMenuHeight - collapseOffset,
    shadowColor: therrTheme.colors.textBlack,
    shadowOffset: {
        height: 1,
        width: 1,
    },
    shadowRadius: 4,
    borderRadius: 100,
    padding: 0,
};

const buttonGroupStyles: any = {
    width: '100%',
    position: 'absolute',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 4,
};

export default StyleSheet.create({
    buttonGroup: {
        ...buttonGroupStyles,
        bottom: 40 + buttonMenuHeight - collapseOffset,
    },
    buttonGroupTop: {
        ...buttonGroupStyles,
        top: 10,
        zIndex: 100,
    },
    buttonGroupFilterList: {
        ...buttonGroupStyles,
        justifyContent: 'space-around',
        bottom: 100 + buttonMenuHeight - collapseOffset,
        zIndex: 100,
    },
    buttonGroupContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        elevation: 2,
        borderRadius: 50,
        shadowOpacity: 0.5,
    },
    leftBtnGroupButtonContainer: {
        borderTopLeftRadius: 50,
        borderBottomLeftRadius: 50,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
    },
    rightBtnGroupButtonContainer: {
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        borderTopRightRadius: 50,
        borderBottomRightRadius: 50,
    },
    btnGroupButtonContainer: {
        borderRadius: 50,
        minWidth: 100,
    },
    mapViewToggleButton: {
        ...btnGroupBtnStyles,
    },
    searchFiltersButton: {
        ...btnGroupBtnStyles,
    },
    searchThisAreaButton: {
        ...btnGroupBtnStyles,
        paddingHorizontal: 15,
        backgroundColor: therrTheme.colors.beemo1,
    },
    searchFiltersTitle: {
        color: therrTheme.colors.beemoTextWhite,
        paddingLeft: 5,
        fontSize: 14,
        lineHeight: 18,
    },
    searchThisAreaTitle: {
        color: therrTheme.colors.beemoTextWhite,
        fontSize: 12,
        lineHeight: 13,
    },
    addMoment: {
        position: 'absolute',
        right: 18,
        bottom: 40 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
    },
    addMomentFromMedia: {
        position: 'absolute',
        right: 18,
        bottom: 100 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
    },
    // collapse: {
    //     position: 'absolute',
    //     right: 18,
    //     bottom: collapseOffset + buttonMenuHeight,
    //     shadowColor: therrTheme.colors.textBlack,
    //     shadowOffset: {
    //         height: 1,
    //         width: 1,
    //     },
    //     shadowRadius: 4,
    //     borderRadius: 100,
    //     padding: 0,
    //     width: 96,
    //     height: 20,
    // },
    compass: {
        position: 'absolute',
        right: 84,
        bottom: 60 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
    },
    toggleFollow: {
        ...leftSmallButton1ViewStyles,
    },
    locationEnable: {
        ...leftSmallButton1ViewStyles,
    },
    recenter: {
        position: 'absolute',
        right: 18,
        bottom: 126 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
    },
    momentLayers: {
        position: 'absolute',
        left: 90,
        bottom: 60 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
    },
    momentLayerOption1: {
        position: 'absolute',
        left: 96,
        bottom: 100 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
        height: 32,
        width: 32,
    },
    momentLayerOption2: {
        position: 'absolute',
        left: 96,
        bottom: 160 + buttonMenuHeight - collapseOffset,
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
        height: 32,
        width: 32,
    },
    momentLayerOption3: {
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
        height: 36,
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
    },
    momentLayerOption4: {
        shadowColor: therrTheme.colors.textBlack,
        shadowOffset: {
            height: 1,
            width: 1,
        },
        shadowRadius: 4,
        borderRadius: 100,
        padding: 0,
        height: 32,
        width: 32,
    },
    notifications: {
        ...bottomLeftBtnViewStyles,
        zIndex: 10,
    },
    refreshMoments: {
        ...bottomLeftBtnViewStyles,
    },
    btn: {
        ...btnStyles,
        backgroundColor: therrTheme.colors.beemo1,
    },
    btnMedium: {
        ...btnStyles,
        backgroundColor: therrTheme.colors.beemo1,
        height: 34,
        width: 34,
    },
    btnLarge: {
        ...btnStyles,
        backgroundColor: therrTheme.colors.beemo1,
        width: 44,
    },
    btnClear: {
        ...btnStyles,
        backgroundColor: 'transparent',
    },
    btnIcon: {
        ...btnIconStyle,
    },
    btnIconWhite: {
        color: therrTheme.colors.beemoTextWhite,
        padding: 0,
    },
    btnIconInactive: {
        color: therrTheme.colors.primary3,
        padding: 0,
    },
    mapView: {
        flex: 1,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    momentAlertOverlayContainer: {
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        padding: 0,
        zIndex: 10000,
    },
});
