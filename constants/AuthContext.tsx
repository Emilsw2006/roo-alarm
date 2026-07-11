import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { requestAuthNavigationRefresh } from '../lib/authNavigationRefresh';

const AUTH_REDIRECT_URL = 'rooalarm://auth/callback';
WebBrowser.maybeCompleteAuthSession();

type OAuthResult = { error: string | null };

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<OAuthResult>;
  signInWithApple: () => Promise<OAuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signInWithApple: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
});

const setSessionFromOAuthUrl = async (url: string) => {
  // El callback puede llegar con los datos en query (?a=b) o en el hash (#a=b).
  const queryString = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url.split('?')[1] ?? '';
  const params = new URLSearchParams(queryString);

  const errorDescription = params.get('error_description') || params.get('error');
  if (errorDescription) {
    return { error: decodeURIComponent(errorDescription.replace(/\+/g, ' ')) };
  }

  // Flujo PKCE (por defecto en supabase-js): vuelve un ?code=... que hay que canjear.
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { error: error.message };
    return { error: null };
  }

  // Flujo implícito: tokens directamente en la URL.
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  return { error: 'No se pudo completar el inicio de sesión.' };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const createSessionFromUrl = async (url: string) => {
      const result = await setSessionFromOAuthUrl(url);
      if (result.error) console.log('OAuth callback error', result.error);
    };

    const finishLoading = (session: Session | null) => {
      if (!cancelled) {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 2000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeoutId);
      finishLoading(session);
    }).catch(() => {
      clearTimeout(timeoutId);
      if (!cancelled) setLoading(false);
    });

    Linking.getInitialURL().then((url: string | null) => {
      if (url) createSessionFromUrl(url).catch(() => {});
    });

    const linkingSubscription = Linking.addEventListener('url', ({ url }: { url: string }) => {
      createSessionFromUrl(url).catch(() => {});
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      linkingSubscription.remove();
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signInWithOAuthProvider = useCallback(async (provider: 'google' | 'apple'): Promise<OAuthResult> => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: AUTH_REDIRECT_URL,
        skipBrowserRedirect: true,
      },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'No se pudo abrir el inicio de sesión.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT_URL);
    if (result.type === 'success' && result.url) {
      return setSessionFromOAuthUrl(result.url);
    }
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { error: null };
    }
    return { error: 'No se pudo completar el inicio de sesión.' };
  }, []);

  const signInWithGoogle = () => signInWithOAuthProvider('google');

  const signInWithApple = useCallback(async (): Promise<OAuthResult> => {
    // En iOS usamos el flujo nativo (Sign in with Apple). El flujo web falla
    // porque Apple responde con form_post y el navegador no devuelve el redirect.
    if (Platform.OS !== 'ios') {
      return signInWithOAuthProvider('apple');
    }

    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        return signInWithOAuthProvider('apple');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { error: 'No se pudo obtener el identificador de Apple.' };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { error: error.message };

      // Apple solo envía el nombre la primera vez; lo guardamos en el perfil.
      const fullName = credential.fullName;
      const displayName = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (displayName && data.user && !data.user.user_metadata?.name) {
        await supabase.auth.updateUser({ data: { name: displayName } });
      }

      return { error: null };
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') {
        return { error: null };
      }
      return { error: err?.message ?? 'No se pudo completar el inicio de sesión con Apple.' };
    }
  }, [signInWithOAuthProvider]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    requestAuthNavigationRefresh();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { error: error.message };
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signInWithApple,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
