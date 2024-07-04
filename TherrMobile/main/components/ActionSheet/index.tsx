import { SheetDefinition, registerSheet } from 'react-native-actions-sheet';
// import ExampleSheet from './ExampleSheet';
import GroupSheet from './GroupSheet';
import { ITherrThemeColors } from '../../styles/themes';

// registerSheet('example-sheet', ExampleSheet);
registerSheet('group-sheet', GroupSheet);

// We extend some of the types here to give us great intellisense
// across the app for all registered sheets.
declare module 'react-native-actions-sheet' {
  interface Sheets {
    // 'example-sheet': SheetDefinition;
    'group-sheet': SheetDefinition<{
        payload: {
            group: any;
            translate: (key: string, params?: any) => string;
            themeForms: {
                colors: ITherrThemeColors;
                styles: any;
            },
            hasGroupEditAccess: boolean;
            onPressEditGroup: (group: any) => void;
            onPressShareGroup: (group: any) => void;
        };
    }>;
  }
}

export {};
