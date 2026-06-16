import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SECURE_STORE_CHUNK_SIZE = 1800;
const chunkKey = (key: string, index: number) => `${key}.chunk.${index}`;
const metaKey = (key: string) => `${key}.meta`;

const ExpoSecureStoreAdapter = {
  async getItem(key: string) {
    const meta = await SecureStore.getItemAsync(metaKey(key));
    if (!meta) return SecureStore.getItemAsync(key);

    const chunkCount = Number(meta);
    if (!Number.isFinite(chunkCount) || chunkCount <= 0) return null;

    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index)))
    );

    if (chunks.some(chunk => chunk == null)) return null;
    return chunks.join('');
  },
  async setItem(key: string, value: string) {
    await ExpoSecureStoreAdapter.removeItem(key);

    if (value.length <= SECURE_STORE_CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = value.match(new RegExp(`.{1,${SECURE_STORE_CHUNK_SIZE}}`, 'g')) || [];
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
    await SecureStore.setItemAsync(metaKey(key), String(chunks.length));
  },
  async removeItem(key: string) {
    const meta = await SecureStore.getItemAsync(metaKey(key));
    const chunkCount = Number(meta);

    await SecureStore.deleteItemAsync(key);
    await SecureStore.deleteItemAsync(metaKey(key));

    if (Number.isFinite(chunkCount) && chunkCount > 0) {
      await Promise.all(
        Array.from({ length: chunkCount }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index)))
      );
    }
  },
};

const supabaseUrl = 'https://lrzucapbjfufwdpishdm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxyenVjYXBiamZ1ZndkcGlzaGRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MjI0NDAsImV4cCI6MjA5NjI5ODQ0MH0.Q2K6QxrwlY_3k1pd8NFRRW97JreMs-TtaPpNG_KDKK8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
