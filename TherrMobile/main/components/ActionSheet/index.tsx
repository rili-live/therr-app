import { SheetDefinition, registerSheet } from 'react-native-actions-sheet';
// import ExampleSheet from './ExampleSheet';
import GroupSheet from './GroupSheet';
import UserSheet from './UserSheet';
import { ITherrThemeColors } from '../../styles/themes';

// registerSheet('example-sheet', ExampleSheet);
registerSheet('group-sheet', GroupSheet);
registerSheet('user-sheet', UserSheet);

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
            canJoinGroup: boolean;
            hasGroupEditAccess: boolean;
            hasGroupArchiveAccess: boolean;
            isGroupMember: boolean;
            onPressArchiveGroup: (group: any) => void;
            onPressEditGroup: (group: any) => void;
            onPressJoinGroup: (group: any) => void;
            onPressLeaveGroup: (group: any) => void;
            onPressShareGroup: (group: any) => void;
        };
    }>;
    'user-sheet': SheetDefinition<{
        payload: {
            userInView: any;
            translate: (key: string, params?: any) => string;
            themeForms: {
                colors: ITherrThemeColors;
                styles: any;
            },
            onPressUpdatedConnectionType: (userId: string, type: 1 | 2 | 3 | 4 | 5) => void;
        };
    }>;
  }
}

export {};
