import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { F } from '../utils/fonts';

const C = {
  bg: '#FFFFFF', text: '#0D0D0D', textLight: '#9B9BAD',
  accent: '#0088CC', border: '#E8E8EF',
};

export default function AppHeader({
  title, subtitle, notifCount = 0, onNotifCountChange, onSettings,
}) {
  return (
    <View style={S.header}>
      <View style={S.left}>
        <Text style={S.title}>{title}</Text>
        {!!subtitle && <Text style={S.subtitle}>{subtitle}</Text>}
      </View>
      <View style={S.right}>
        {notifCount > 0 && (
          <TouchableOpacity style={S.notifBtn} onPress={() => onNotifCountChange?.(0)}>
            <Ionicons name="notifications-outline" size={22} color={C.accent} />
            <View style={S.badge}>
              <Text style={S.badgeTxt}>{notifCount > 9 ? '9+' : notifCount}</Text>
            </View>
          </TouchableOpacity>
        )}
        {!!onSettings && (
          <TouchableOpacity style={S.iconBtn} onPress={onSettings}>
            <Ionicons name="settings-outline" size={22} color={C.textLight} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
               paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.bg,
               borderBottomWidth: 1, borderBottomColor: C.border },
  left:     { flex: 1 },
  title:    { fontSize: 18, fontFamily: F.extrabold, color: C.text },
  subtitle: { fontSize: 10, fontFamily: F.bold, color: C.textLight, letterSpacing: 1.5, marginTop: 2 },
  right:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifBtn: { position: 'relative', padding: 6 },
  badge:    { position: 'absolute', top: 2, right: 2, backgroundColor: '#EF4444',
               borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 9, fontWeight: '700' },
  iconBtn:  { padding: 6 },
});
