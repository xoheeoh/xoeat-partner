import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 웹에는 SecureStore 네이티브 모듈이 없으므로 네이티브에서만 지연 로드한다.
const SecureStore = Platform.OS === 'web' ? null : (require('expo-secure-store') as typeof import('expo-secure-store'));

/* ── 보안 저장소 ──────────────────────────────────────────────────
 * expo-secure-store(Keychain/Keystore)는 값 하나에 2KB 제한이 있어 긴 값은 조각내어 저장한다.
 * 웹은 SecureStore 가 없어 localStorage 를 쓴다.
 */
const CHUNK = 1800;

const webStore = {
  getItem: async (k: string) => {
    try {
      return globalThis.localStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (k: string, v: string) => {
    try {
      globalThis.localStorage?.setItem(k, v);
    } catch {}
  },
  removeItem: async (k: string) => {
    try {
      globalThis.localStorage?.removeItem(k);
    } catch {}
  },
};

const nativeStore = {
  async getItem(key: string) {
    if (!SecureStore) return null;
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    if (!count) return null;
    const parts = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return parts.some((p) => p == null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    if (!SecureStore) return;
    const parts = value.match(new RegExp(`.{1,${CHUNK}}`, 'g')) ?? [];
    await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p)));
    await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
  },
  async removeItem(key: string) {
    if (!SecureStore) return;
    const count = Number(await SecureStore.getItemAsync(`${key}.n`));
    await Promise.all(Array.from({ length: count || 0 }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
    await SecureStore.deleteItemAsync(`${key}.n`);
  },
};

/** Supabase 세션 저장에도 같은 저장소를 쓴다. */
export const secureStorage = Platform.OS === 'web' ? webStore : nativeStore;

// 데이터 저장
export const storeData = async (key: string, value: any) => {
  try {
    const stringValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, stringValue);
  } catch (error: any) {
    console.error('데이터 저장 오류:', error.message);
  }
};

// 객체 값 병합 저장
export const mergeData = async <T>(key: string, newData: Partial<T>): Promise<void> => {
  try {
    const existingData = await AsyncStorage.getItem(key);
    const parsedData: T = existingData ? JSON.parse(existingData) : ({} as T);

    const mergedData = { ...parsedData, ...newData };

    await AsyncStorage.setItem(key, JSON.stringify(mergedData));
  } catch (error: any) {
    console.error(`${key} 데이터 병합 오류:`, error.message);
  }
};

// 데이터 불러오기
export const getData = async <T>(key: string): Promise<T | null> => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value) {
      return JSON.parse(value) as T;
    }
  } catch (error: any) {
    console.error(`${key} 데이터 불러오기 오류:`, error.message);
  }
  return null;
};

// 데이터 삭제하기
export const removeData = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error: any) {
    console.error('데이터 삭제 오류:', error.message);
  }
};
