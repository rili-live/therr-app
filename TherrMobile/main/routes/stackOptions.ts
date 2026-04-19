import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

export const viewStackOptions: Partial<NativeStackNavigationOptions> = {
    headerLeft: () => null,
    headerTitleAlign: 'left',
};

export const momentStackOptions: Partial<NativeStackNavigationOptions> = {
    animation: 'fade',
};

export const editStackOptions: Partial<NativeStackNavigationOptions> = {
    ...viewStackOptions,
    ...momentStackOptions,
};
