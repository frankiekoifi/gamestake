// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { HomeScreen } from './screens/HomeScreen';
import { MatchesScreen } from './screens/MatchesScreen';
import { WalletScreen } from './screens/WalletScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { TournamentScreen } from './screens/TournamentScreen';
import { MatchDetailScreen } from './screens/MatchDetailScreen';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const MatchesStack = () => (
  <Stack.Navigator>
    <Stack.Screen 
      name="MatchesList" 
      component={MatchesScreen} 
      options={{ title: 'Matches' }}
    />
    <Stack.Screen 
      name="MatchDetail" 
      component={MatchDetailScreen} 
      options={{ title: 'Match Details' }}
    />
  </Stack.Navigator>
);

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused, color, size }) => {
                let iconName;
                if (route.name === 'Home') {
                  iconName = 'home';
                } else if (route.name === 'Matches') {
                  iconName = 'sports-esports';
                } else if (route.name === 'Tournaments') {
                  iconName = 'emoji-events';
                } else if (route.name === 'Wallet') {
                  iconName = 'account-balance-wallet';
                } else if (route.name === 'Profile') {
                  iconName = 'person';
                }
                return <Icon name={iconName} size={size} color={color} />;
              },
              tabBarActiveTintColor: '#3b82f6',
              tabBarInactiveTintColor: 'gray',
            })}
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Matches" component={MatchesStack} />
            <Tab.Screen name="Tournaments" component={TournamentScreen} />
            <Tab.Screen name="Wallet" component={WalletScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;