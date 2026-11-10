import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchAuthMe, setAuthToken } from "../api/gizegoApi.js";

const STORAGE_KEY = "gizego_auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const userRef = useRef(null);
  const tokenRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) {
            tokenRef.current = parsed.token;
            userRef.current = parsed.user ?? null;
            setAuthToken(parsed.token);
            setToken(parsed.token);

            try {
              const me = await fetchAuthMe();
              if (me?.user) {
                userRef.current = me.user;
                setUser(me.user);
                await AsyncStorage.setItem(
                  STORAGE_KEY,
                  JSON.stringify({ token: parsed.token, user: me.user }),
                );
              } else if (parsed.user) {
                setUser(parsed.user);
              }
            } catch {
              if (parsed.user) setUser(parsed.user);
            }
          }
        }
      } catch {
        await AsyncStorage.removeItem(STORAGE_KEY);
        tokenRef.current = null;
        userRef.current = null;
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = async (nextToken, nextUser) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  };

  const getUser = useCallback(() => userRef.current, []);

  const signIn = async (nextToken, nextUser) => {
    tokenRef.current = nextToken;
    userRef.current = nextUser;
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    await persist(nextToken, nextUser);
  };

  const signOut = async () => {
    tokenRef.current = null;
    userRef.current = null;
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  const updateUser = async (nextUser) => {
    const currentToken = token ?? tokenRef.current;
    if (!currentToken || !nextUser) return;
    userRef.current = nextUser;
    setUser(nextUser);
    await persist(currentToken, nextUser);
  };

  const activeUser = user ?? userRef.current;

  const value = useMemo(
    () => ({
      token: token ?? tokenRef.current,
      user: activeUser,
      ready,
      isPassenger: activeUser?.role === "passenger",
      isDriver: activeUser?.role === "driver",
      getUser,
      signIn,
      signOut,
      updateUser,
    }),
    [token, activeUser, ready, getUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
