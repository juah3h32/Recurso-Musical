import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import TutorialesScreen from '../screens/TutorialsScreen';
import FavoritosScreen  from '../screens/FavoritosScreen';
import ExtrasScreen     from '../screens/ExtrasScreen';

const Tab = createBottomTabNavigator();

const C = {
  white:  '#FFFFFF',
  accent: '#0088CC',
  inactive: '#B0B0C0',
  border: '#EBEBF0',
};

const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background:   C.white,
    card:         C.white,
    border:       C.border,
    primary:      C.accent,
    text:         '#0D0D0D',
    notification: C.accent,
  },
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  name, focused,
}: { name: IoniconName; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={name}
        size={22}
        color={focused ? C.accent : C.inactive}
      />
    </View>
  );
}

function BibliotecaTab() {
  return <ExtrasScreen notifCount={0} onNotifCountChange={() => {}} />;
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={NAV_THEME}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor:   C.accent,
          tabBarInactiveTintColor: C.inactive,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tab.Screen
          name="TutorialesTab"
          component={TutorialesScreen}
          options={{
            title: 'Tutoriales',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'play-circle' : 'play-circle-outline'} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="FavoritosTab"
          component={FavoritosScreen}
          options={{
            title: 'Canciones',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'musical-notes' : 'musical-notes-outline'} focused={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="BibliotecaTab"
          component={BibliotecaTab}
          options={{
            title: 'Biblioteca',
            tabBarIcon: ({ focused }) => (
              <TabIcon name={focused ? 'book' : 'book-outline'} focused={focused} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor:  C.white,
    borderTopColor:   C.border,
    borderTopWidth:   1,
    height:           68,
    paddingBottom:    10,
    paddingTop:       6,
    elevation:        0,
    shadowOpacity:    0,
  },
  tabLabel: {
    fontFamily:   'Montserrat_600SemiBold',
    fontSize:     10,
    letterSpacing: 0.3,
    marginTop:    2,
  },
  iconWrap: {
    width:        44,
    height:       30,
    alignItems:   'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconWrapActive: {
    backgroundColor: '#0088CC0F',
  },
});
