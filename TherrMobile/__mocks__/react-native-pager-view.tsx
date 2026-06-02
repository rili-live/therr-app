import React from 'react';
import { View } from 'react-native';

// Minimal mock so multi-photo carousel tests render without the native pager module.
const PagerView = ({ children, ...props }: any) => <View {...props} testID="mock-pager-view">{children}</View>;

export default PagerView;
