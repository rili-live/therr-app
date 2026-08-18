import React from 'react';
import ActionSheet, { ActionSheetProps, ActionSheetRef } from 'react-native-actions-sheet';

/**
 * Shared defaults for every bottom sheet in the app. Register sheets in `./index.tsx` and
 * render this instead of the library's `ActionSheet` directly.
 *
 * `isModal={false}` is the important one. By default the library renders each sheet inside a
 * React Native `<Modal>`, which on Android is a *separate native Dialog window* — created on
 * every open and torn down on every close, since `SheetProvider` unmounts a sheet when it
 * closes. That window creation was the single largest remaining cost in the open path, and
 * on the way out the Dialog keeps owning touch input for the whole exit animation, so a
 * scroll gesture started right after dismissing the sheet lands on the backdrop instead of
 * the list underneath. With `isModal={false}` the sheet is an absolutely positioned view
 * inside the tree we already have — `App.tsx` mounts the `GestureHandlerRootView` the sheet's
 * pan handler needs, and the library falls through to it (see `GestureHandlerRoot` in the
 * library's `dist/src/index.js`).
 *
 * `gestureEnabled` lets a swipe down dismiss the sheet, which is both faster than reaching
 * for the backdrop and the gesture users try first. It also renders the drag indicator.
 *
 * Both are overridable per sheet — pass the prop and it wins.
 */
const BaseActionSheet = React.forwardRef<ActionSheetRef, ActionSheetProps>((props, ref) => (
    <ActionSheet
        isModal={false}
        gestureEnabled
        {...props}
        ref={ref}
    />
));

BaseActionSheet.displayName = 'BaseActionSheet';

export default BaseActionSheet;
