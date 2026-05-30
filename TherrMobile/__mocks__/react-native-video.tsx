import React from 'react';
import { View } from 'react-native';

// Minimal mock so component tests can render LiveMomentMedia without the native module.
const Video = (props: any) => <View {...props} testID="mock-rn-video" />;

export default Video;
