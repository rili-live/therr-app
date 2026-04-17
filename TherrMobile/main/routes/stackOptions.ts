import { StackNavigationOptions } from '@react-navigation/stack';

export const momentTransitionSpec: StackNavigationOptions['transitionSpec'] = {
    open: {
        animation: 'spring',
        config: {
            stiffness: 100,
            damping: 200,
            mass: 3,
            overshootClamping: true,
            restDisplacementThreshold: 0.9,
            restSpeedThreshold: 0.1,
        },
    },
    close: {
        animation: 'spring',
        config: {
            stiffness: 250,
            damping: 300,
            mass: 3,
            overshootClamping: true,
            restDisplacementThreshold: 0.1,
            restSpeedThreshold: 0.5,
        },
    },
};

export const viewStackOptions: Partial<StackNavigationOptions> = {
    headerLeft: () => null,
    headerTitleAlign: 'left',
};

export const momentStackOptions: Partial<StackNavigationOptions> = {
    cardStyleInterpolator: undefined,
    transitionSpec: momentTransitionSpec,
};

export const editStackOptions: Partial<StackNavigationOptions> = {
    ...viewStackOptions,
    ...momentStackOptions,
};
