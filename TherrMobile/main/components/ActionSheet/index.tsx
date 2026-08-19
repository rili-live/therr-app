/**
 * Every bottom sheet in the app is registered here and opened through `SheetManager.show`.
 * Each sheet renders `./BaseActionSheet` rather than the library's `ActionSheet` directly —
 * see that file for the shared defaults and why they matter on Android.
 *
 * NOTE: `patches/react-native-actions-sheet+0.9.8.patch` removes a 300ms delay this library
 * puts in front of every sheet on Android. Upstream defers its internal `safeAreaLayout`
 * event by 300ms on the first root layout of an `ActionSheet` mount, to give iOS's
 * `SafeAreaView` inset probes time to report. Those probes are never rendered on Android
 * (inset comes from `StatusBar.currentHeight`, read synchronously), so the wait measures
 * nothing — and because `SheetProvider` unmounts a sheet when it closes, the "first" layout
 * is every layout. That is a flat 300ms between the tap and the sheet starting to animate,
 * on every open of every sheet. Symptom that led here: the 3-dot menu on a user profile
 * taking a visibly long time to appear.
 */
import { SheetDefinition, registerSheet } from 'react-native-actions-sheet';
import GroupSheet from './GroupSheet';
import UserSheet from './UserSheet';
import ContentOptionsSheet, { IContentSelectionType } from './ContentOptionsSheet';
import UserProfileSheet, { IUserProfileAction } from './UserProfileSheet';
import VisibilityPickerSheet from './VisibilityPickerSheet';
import ImagePickerSheet from './ImagePickerSheet';
import ListPickerSheet from './ListPickerSheet';
import { ITherrThemeColors } from '../../styles/themes';

registerSheet('group-sheet', GroupSheet);
registerSheet('user-sheet', UserSheet);
registerSheet('content-options-sheet', ContentOptionsSheet);
registerSheet('user-profile-sheet', UserProfileSheet);
registerSheet('visibility-picker-sheet', VisibilityPickerSheet);
registerSheet('image-picker-sheet', ImagePickerSheet);
registerSheet('list-picker-sheet', ListPickerSheet);

// We extend some of the types here to give us great intellisense
// across the app for all registered sheets.
declare module 'react-native-actions-sheet' {
  interface Sheets {
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
    'content-options-sheet': SheetDefinition<{
        payload: {
            contentType: 'area' | 'thought';
            shouldIncludeShareButton?: boolean;
            translate: (key: string, params?: any) => string;
            themeForms: {
                colors: ITherrThemeColors;
                styles: any;
            };
            onSelect: (type: IContentSelectionType) => void;
        };
    }>;
    'user-profile-sheet': SheetDefinition<{
        payload: {
            actions: IUserProfileAction[];
            translate: (key: string, params?: any) => string;
            themeForms: {
                colors: ITherrThemeColors;
                styles: any;
            };
            onAction: (action: IUserProfileAction) => void;
        };
    }>;
    'visibility-picker-sheet': SheetDefinition<{
        payload: {
            publicText: string;
            privateText: string;
            themeForms: {
                styles: any;
            };
            onSelect: (isPublic: boolean) => void;
        };
    }>;
    'image-picker-sheet': SheetDefinition<{
        payload: {
            galleryText: string;
            cameraText: string;
            themeForms: {
                styles: any;
            };
            onSelect: (source: 'upload' | 'camera') => void;
        };
    }>;
    'list-picker-sheet': SheetDefinition<{
        payload: {
            spaceId: string;
            translate: (key: string, params?: any) => string;
            themeForms: {
                colors: ITherrThemeColors;
                styles: any;
            };
            onChange?: () => void;
        };
    }>;
  }
}

export {};
