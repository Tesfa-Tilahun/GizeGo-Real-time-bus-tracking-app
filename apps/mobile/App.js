import React, { useRef, useEffect } from "react";
import { Text, TextInput, Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LocaleProvider } from "./src/context/LocaleContext.js";
import { AuthProvider, useAuth } from "./src/context/AuthContext.js";
import { RealtimeProvider } from "./src/context/RealtimeContext.js";
import { RoutePreferencesProvider } from "./src/context/RoutePreferencesContext.js";
import { useNotificationBootstrap } from "./src/hooks/usePassengerNotifications.js";
import { HomeScreen } from "./src/screens/HomeScreen.js";
import { MapScreen } from "./src/screens/MapScreen.js";
import { BrowseRoutesScreen } from "./src/screens/BrowseRoutesScreen.js";
import { FeedbackScreen } from "./src/screens/FeedbackScreen.js";
import { LoginScreen } from "./src/screens/LoginScreen.js";
import { SignUpScreen } from "./src/screens/SignUpScreen.js";
import { ForgotPasswordScreen } from "./src/screens/ForgotPasswordScreen.js";
import { ResetPasswordScreen } from "./src/screens/ResetPasswordScreen.js";
import { DriverLoginScreen } from "./src/screens/DriverLoginScreen.js";
import { DriverDashboardScreen } from "./src/screens/DriverDashboardScreen.js";
import { DriverProfileScreen } from "./src/screens/DriverProfileScreen.js";

// Global Typography & Font Size Polishing
const targetFontFamily = Platform.OS === "ios" ? "Helvetica Neue" : "sans-serif";

// 1. Prevent system accessibility text size scaling from breaking the UI
if (Text.defaultProps == null) {
  Text.defaultProps = {};
}
Text.defaultProps.allowFontScaling = false;

if (TextInput.defaultProps == null) {
  TextInput.defaultProps = {};
}
TextInput.defaultProps.allowFontScaling = false;

// 2. Intercept Text rendering to globally scale down font sizes slightly and apply a clean font family
const originalTextRender = Text.render;
if (originalTextRender) {
  Text.render = function (...args) {
    const element = originalTextRender.call(this, ...args);
    const style = StyleSheet.flatten(element.props.style) || {};
    
    const newStyle = {
      fontFamily: targetFontFamily,
    };
    
    // Scale down font sizes globally by ~8% to make everything look incredibly clean and compact
    if (typeof style.fontSize === "number") {
      newStyle.fontSize = Math.max(10, Math.round(style.fontSize * 0.92));
    }
    
    return React.cloneElement(element, {
      style: [newStyle, element.props.style],
    });
  };
} else {
  // Fallback for older React Native versions
  Text.defaultProps.style = {
    fontFamily: targetFontFamily,
  };
}

const Stack = createNativeStackNavigator();

function AppRoot() {
  useNotificationBootstrap();
  const navigationRef = useRef(null);
  const bootRouted = useRef(false);
  const { ready, user, isDriver } = useAuth();

  useEffect(() => {
    if (!ready || !navigationRef.current || bootRouted.current) return;
    bootRouted.current = true;
    if (isDriver && user) {
      navigationRef.current.reset({ index: 0, routes: [{ name: "DriverDashboard" }] });
    }
  }, [ready, isDriver, user]);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Map" component={MapScreen} />
        <Stack.Screen name="BrowseRoutes" component={BrowseRoutesScreen} />
        <Stack.Screen name="Feedback" component={FeedbackScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="DriverLogin" component={DriverLoginScreen} />
        <Stack.Screen name="DriverDashboard" component={DriverDashboardScreen} />
        <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
          <RealtimeProvider>
            <RoutePreferencesProvider>
              <AppRoot />
            </RoutePreferencesProvider>
          </RealtimeProvider>
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
