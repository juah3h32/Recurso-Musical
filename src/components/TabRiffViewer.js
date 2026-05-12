import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default function TabRiffViewer({ tab, style }) {
  if (!tab) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={[S.wrap, style]}>
      <Text style={S.tab}>{tab}</Text>
    </ScrollView>
  );
}

const S = StyleSheet.create({
  wrap: { backgroundColor: '#0D0D0D', borderRadius: 8, padding: 12 },
  tab:  { fontFamily: 'monospace', fontSize: 12, color: '#00BFFF', lineHeight: 20 },
});
