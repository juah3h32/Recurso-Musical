import React from 'react';
import { Text } from 'react-native';
import { F } from '../utils/fonts';

export default function AppText({ weight = 'regular', style, children, ...props }) {
  return (
    <Text style={[{ fontFamily: F[weight] || F.regular }, style]} {...props}>
      {children}
    </Text>
  );
}
