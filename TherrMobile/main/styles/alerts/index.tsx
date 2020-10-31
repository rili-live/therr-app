import { StyleSheet } from 'react-native';

const containerStyle: any = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    paddingLeft: 35,
    borderRadius: 0,
};

const iconStyle: any = {
    position: 'absolute',
    left: 10,
};

const messageStyle: any = {
    textAlign: 'center',
    fontSize: 16,
};

export const alertMsg = StyleSheet.create({
    containerSuccess: {
        ...containerStyle,
        backgroundColor: 'rgba(242, 251, 246, .75)',
    },
    containerError: {
        ...containerStyle,
        backgroundColor: 'rgba(251, 243, 242, .75)',
    },
    error: {
        ...messageStyle,
        color: '#AA0042',
    },
    success: {
        ...messageStyle,
        color: '#008C3D',
    },
    iconError: {
        ...iconStyle,
        color: '#AA0042',
    },
    iconSuccess: {
        ...iconStyle,
        color: '#008C3D',
    },
});