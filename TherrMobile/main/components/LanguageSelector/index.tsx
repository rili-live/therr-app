import * as React from 'react';
import { Text, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';

interface ILanguageSelectorProps {
    locale: string;
    onChangeLocale: (locale: string) => void;
    translate: (key: string, params?: any) => string;
    theme: {
        styles: any;
    };
    containerStyle?: any;
}

// Locale values mirror the post-login picker in Settings and the supported mobile
// dictionaries (en-us, es, fr-ca). Labels are intentionally rendered in their own
// language so they're recognizable regardless of the currently-active locale.
const LANGUAGE_OPTIONS = [
    { value: 'en-us', label: 'English', icon: 'translate' },
    { value: 'es', label: 'Español', icon: 'translate' },
    { value: 'fr-ca', label: 'Français', icon: 'translate' },
];

/**
 * Pre-login language/locale selector. Lets users who need a translation in order to
 * register or sign in switch languages before authenticating. Selection is handled by
 * the `setPreLoginLocale` thunk (Redux + local persistence) and carried into the new
 * account at registration.
 */
const LanguageSelector: React.FC<ILanguageSelectorProps> = ({
    locale,
    onChangeLocale,
    translate,
    theme,
    containerStyle,
}) => {
    const selectedValue = LANGUAGE_OPTIONS.some((option) => option.value === locale)
        ? locale
        : 'en-us';

    return (
        <View style={containerStyle}>
            <Text style={[theme.styles.sectionDescription, { textAlign: 'center', marginBottom: 8 }]}>
                {translate('forms.languageSelector.label')}
            </Text>
            <SegmentedButtons
                value={selectedValue}
                onValueChange={onChangeLocale}
                buttons={LANGUAGE_OPTIONS}
            />
        </View>
    );
};

export default LanguageSelector;
