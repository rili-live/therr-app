declare module 'rili-utilities/localization' {
    export const normalizeLocale: (locale: string) => string;
    export const fallbackToLocale: (originalLocale: string) => string;
    export const configureTranslator: (translations: any) => (locale: string, key: string, params: any) => any;
}