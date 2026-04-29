import { ViewStyle } from 'react-native';
import { BRAND_BLACK } from './themes/brandConstants';

// Bundled iOS shadow + Android elevation tokens. Spread one of these into a
// container's style to get a consistent lift across both platforms:
//
//   container: { ...shadowSm, backgroundColor: theme.colors.surface }
//
// All three tokens use `shadowOpacity > 0`. Many existing inline shadow blocks
// in the codebase declare shadowColor/Offset/Radius without shadowOpacity,
// which means iOS renders no shadow at all today — only Android elevation
// shows up. Adopting these tokens intentionally makes the iOS shadow visible
// (matching what the Android elevation already conveys).

type Elevation = Pick<
    ViewStyle,
    'shadowColor' | 'shadowOffset' | 'shadowRadius' | 'shadowOpacity' | 'elevation'
>;

// shadowSm — subtle lift for floating action buttons, badges, small chips.
export const shadowSm: Elevation = {
    shadowColor: BRAND_BLACK,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    shadowOpacity: 0.15,
    elevation: 2,
};

// shadowMd — raised buttons, popovers, sticky headers, button groups.
export const shadowMd: Elevation = {
    shadowColor: BRAND_BLACK,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    shadowOpacity: 0.20,
    elevation: 4,
};

// shadowLg — modals, menus, sheets — anything that needs to lift well above
// content beneath it.
export const shadowLg: Elevation = {
    shadowColor: BRAND_BLACK,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 0.30,
    elevation: 8,
};
