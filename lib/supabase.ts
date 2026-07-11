import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SECURE_STORE_CHUNK_SIZE = 1800;
const chunkKey = (key: string, index: number) => `${key}.chunk.${index}`;
const metaKey = (key: string) => `${key}.meta`;

// Algunos binarios de desarrollo no incluyen el módulo nativo ExpoSecureStore.
// El paquete expo-secure-store resuelve el módulo nativo AL IMPORTARSE, por lo que
// un import estático revienta toda la app ("Cannot find native module 'ExpoSecureStore'").
// Lo cargamos de forma perezosa y protegida; si no está, usamos AsyncStorage para
// que la sesión de Supabase persista igualmente (login Apple/Google/email).
type SecureStoreModule = typeof import('expo-secure-store');
let secureStore: SecureStoreModule | null | undefined;

const getSecureStore = (): SecureStoreModule | null => {
  if (secureStore !== undefined) return secureStore;
  try {
    const mod = require('expo-secure-store') as SecureStoreModule;
    // Forzamos el acceso a un método para detectar módulos nativos ausentes.
    if (typeof mod.getItemAsync !== 'function') throw new Error('unavailable');
    secureStore = mod;
  } catch {
    secureStore = null;
  }
  return secureStore;
};

const ExpoSecureStoreAdapter = {
  async getItem(key: string) {
    const store = getSecureStore();
    if (!store) return AsyncStorage.getItem(key);

    try {
      const meta = await store.getItemAsync(metaKey(key));
      if (!meta) return store.getItemAsync(key);

      const chunkCount = Number(meta);
      if (!Number.isFinite(chunkCount) || chunkCount <= 0) return null;

      const chunks = await Promise.all(
        Array.from({ length: chunkCount }, (_, index) => store.getItemAsync(chunkKey(key, index)))
      );

      if (chunks.some(chunk => chunk == null)) return null;
      return chunks.join('');
    } catch {
      return AsyncStorage.getItem(key);
    }
  },
  async setItem(key: string, value: string) {
    const store = getSecureStore();
    if (!store) {
      await AsyncStorage.setItem(key, value);
      return;
    }

    try {
      await ExpoSecureStoreAdapter.removeItem(key);

      if (value.length <= SECURE_STORE_CHUNK_SIZE) {
        await store.setItemAsync(key, value);
        return;
      }

      const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, 'g')) || [];
      await Promise.all(chunks.map((chunk, index) => store.setItemAsync(chunkKey(key, index), chunk)));
      await store.setItemAsync(metaKey(key), String(chunks.length));
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string) {
    const store = getSecureStore();
    if (!store) {
      await AsyncStorage.removeItem(key);
      return;
    }

    try {
      const meta = await store.getItemAsync(metaKey(key));
      const chunkCount = Number(meta);

      await store.deleteItemAsync(key);
      await store.deleteItemAsync(metaKey(key));

      if (Number.isFinite(chunkCount) && chunkCount > 0) {
        await Promise.all(
          Array.from({ length: chunkCount }, (_, index) => store.deleteItemAsync(chunkKey(key, index)))
        );
      }
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
