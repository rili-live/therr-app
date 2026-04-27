import './ReactotronConfig';
import React, { useMemo } from 'react';
import { InteractionManager, StyleSheet } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import LogRocket from '@logrocket/react-native';
import { getAnalytics, setAnalyticsCollectionEnabled } from '@react-native-firebase/analytics';
import Toast, { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message';
import { SheetProvider } from 'react-native-actions-sheet';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { SystemBars } from 'react-native-edge-to-edge';
import {
    SpotlightTourProvider,
} from 'react-native-spotlight-tour';
import { PaperProvider } from 'react-native-paper';
import { useSelector } from 'react-redux';
import getStore from './getStore';
import initInterceptors from './interceptors';
import { FeatureFlagProvider } from './context/FeatureFlagContext';
import Layout from './components/Layout';
import { buttonMenuHeight } from './styles/navigation/buttonMenu';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import spacingStyles from './styles/layouts/spacing';
import { HEADER_HEIGHT_MARGIN } from './styles';
import getTourSteps from './getTourSteps';
import UsersActions from './redux/actions/UsersActions';
import { getPaperTheme } from './styles/themes';
import {
    ALERT_INFO,
    ALERT_SUCCESS,
    ALERT_WARNING,
    ALERT_ERROR,
} from './styles/themes/brandConstants';
import { therrFontFamily } from './styles/font';
import { startNetworkListener } from './utilities/networkService';
import './components/ActionSheet';

// Disable in development
setAnalyticsCollectionEnabled(getAnalytics(), !__DEV__);


// Reads theme name from Redux and provides the correct Paper theme to children
const ThemedPaperProvider = ({ children }: { children: React.ReactNode }) => {
    const themeName = useSelector((state: any) => state?.user?.settings?.mobileThemeName);
    const paperTheme = useMemo(() => getPaperTheme(themeName), [themeName]);

    return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
};

const toastStyles = StyleSheet.create({
    text1: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: therrFontFamily,
    },
    text2: {
        fontSize: 14,
        fontFamily: therrFontFamily,
    },
    infoBorder: { borderLeftColor: ALERT_INFO },
    successBorder: { borderLeftColor: ALERT_SUCCESS },
    warnBorder: { borderLeftColor: ALERT_WARNING },
    errorBorder: { borderLeftColor: ALERT_ERROR },
});

const toastConfig = {
    info: (props) => (
        <InfoToast
            {...props}
            style={toastStyles.infoBorder}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
        />
    ),
    success: (props) => (
        <BaseToast
            {...props}
            style={toastStyles.successBorder}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
        />
    ),
    successBig: (props) => (
        <BaseToast
            {...props}
            style={[toastStyles.successBorder, props?.props?.extraStyle]}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
            text2NumberOfLines={3}
            renderLeadingIcon={props?.props?.renderLeadingIcon}
            renderTrailingIcon={props?.props?.renderTrailingIcon}
        />
    ),
    warn: (props) => (
        <ErrorToast
            {...props}
            style={toastStyles.warnBorder}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
        />
    ),
    warnBig: (props) => (
        <ErrorToast
            {...props}
            style={toastStyles.warnBorder}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
            text2NumberOfLines={3}
        />
    ),
    notifyPublic: (props) => (
        <ErrorToast
            {...props}
            style={[toastStyles.infoBorder, props?.props?.extraStyle]}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
            text2NumberOfLines={3}
            renderLeadingIcon={props?.props?.renderLeadingIcon}
            renderTrailingIcon={props?.props?.renderTrailingIcon}
        />
    ),
    error: (props) => (
        <ErrorToast
            {...props}
            style={toastStyles.errorBorder}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
            text2NumberOfLines={2}
        />
    ),
    errorBig: (props) => (
        <ErrorToast
            {...props}
            style={toastStyles.errorBorder}
            text1Style={toastStyles.text1}
            text2Style={toastStyles.text2}
            text2NumberOfLines={3}
        />
    ),
};

class App extends React.Component<any, any> {
    private store;
    private persistor;

    constructor(props) {
        super(props);

        this.state = {
            isLoading: true,
        };
    }

    componentDidMount() {
        this.loadStorage();

        if (!__DEV__) {
            // Defer SDK init until after first paint to avoid blocking time-to-interactive
            InteractionManager.runAfterInteractions(() => {
                LogRocket.init('pibaqj/therr-app-mobile', {
                    network: {
                        requestSanitizer: request => {
                            if (request.headers.authorization) {
                                request.headers.authorization = '';
                            }
                            if (request.body?.toString().includes('password')) {
                                request.body = '';
                            }

                            return request;
                        },
                        responseSanitizer: response => {
                            if (response.body?.toString().includes('password') || response.body?.toString().includes('idToken')) {
                                response.body = '';
                            }

                            return response;
                        },
                    },
                    console: {
                        shouldAggregateConsoleErrors: true,
                    },
                    redactionTags: ['RedactionString'],
                });
            });
        }
    }

    loadStorage = () => {
        getStore().then(({ store, persistor }) => {
            this.store = store;
            this.persistor = persistor;
            initInterceptors(this.store);
            startNetworkListener(this.store.dispatch);

            this.setState({
                isLoading: false,
            });
        }).catch((err) => {
            console.log(err);
        });
    };

    render() {
        const { isLoading } = this.state;

        if (isLoading || !this.store) {
            return null;
        }

        return (
            <SafeAreaProvider initialMetrics={initialWindowMetrics}>
                <SystemBars style="auto" />
                <Provider store={this.store}>
                    <PersistGate loading={null} persistor={this.persistor}>
                        <FeatureFlagProvider>
                            <GestureHandlerRootView style={spacingStyles.flexOne}>
                                <KeyboardProvider>
                                    <ThemedPaperProvider>
                                        <SpotlightTourProvider
                                            steps={getTourSteps({
                                                locale: this.store.getState()?.user?.settings?.locale || 'en-us',
                                            })}
                                            onBackdropPress="continue" // In case the tour gets stuck
                                            overlayColor={'gray'}
                                            overlayOpacity={0.4}
                                            // This configurations will apply to all steps
                                            floatingProps={{
                                                placement: 'bottom',
                                            }}
                                            onStop={() => {
                                                return this.store?.dispatch(UsersActions.updateTour({
                                                    isTouring: false,
                                                    isNavigationTouring: false,
                                                }));
                                            }}
                                        >
                                            {
                                                ({ start, stop }) => (
                                                    <SheetProvider>
                                                        <Layout startNavigationTour={start} stopNavigationTour={stop} />
                                                    </SheetProvider>
                                                )
                                            }
                                        </SpotlightTourProvider>
                                    </ThemedPaperProvider>
                                </KeyboardProvider>
                            </GestureHandlerRootView>
                            <Toast
                                config={toastConfig}
                                position="bottom"
                                bottomOffset={buttonMenuHeight + 10}
                                topOffset={HEADER_HEIGHT_MARGIN + 30}
                            />
                        </FeatureFlagProvider>
                    </PersistGate>
                </Provider>
            </SafeAreaProvider>
        );
    }
}

export default App;
