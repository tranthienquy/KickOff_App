
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { AppState, INITIAL_STATE } from '../types.ts';

const firebaseConfig = {
  apiKey: "AIzaSyCLMKqjAdZQYtmNloq05uQpqMAIKQYgo1Y",
  authDomain: "ai-young-guru-55339.firebaseapp.com",
  databaseURL: "https://ai-young-guru-55339-default-rtdb.firebaseio.com",
  projectId: "ai-young-guru-55339",
  storageBucket: "ai-young-guru-55339.firebasestorage.app",
  messagingSenderId: "441913380578",
  appId: "1:441913380578:web:bfacc21705c626c5ff58bb",
  measurementId: "G-KW4NTD3Z2Z"
};

const isConfigValid = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

let db: Database | null = null;
let storage: FirebaseStorage | null = null;
let serverTimeOffset = 0;

if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    storage = getStorage(app);
    
    // Theo dõi độ lệch thời gian giữa Client và Server
    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snap) => {
      serverTimeOffset = snap.val() || 0;
      console.log("⏰ Server time offset updated:", serverTimeOffset, "ms");
    });

  } catch (error) {
    console.error("❌ Firebase Init Error:", error);
  }
}

const stateRef = db ? ref(db, 'eventState') : null;

export { storage };

// Hàm lấy thời gian chuẩn đã đồng bộ với Server
export const getServerTime = () => Date.now() + serverTimeOffset;

let localState = { ...INITIAL_STATE };
let localListeners: ((state: AppState) => void)[] = [];

export const syncState = (callback: (state: AppState) => void) => {
  if (stateRef) {
    return onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) callback(data);
      else {
        set(stateRef, { ...INITIAL_STATE, timestamp: getServerTime() });
        callback(INITIAL_STATE);
      }
    });
  } else {
    setTimeout(() => callback(localState), 0);
    localListeners.push(callback);
    return () => { localListeners = localListeners.filter(l => l !== callback); };
  }
};

export const updateStatus = (status: AppState['status']) => {
  if (stateRef) return update(stateRef, { status, timestamp: getServerTime() });
  localState = { ...localState, status, timestamp: getServerTime() };
  localListeners.forEach(l => l(localState));
};

export const updateUrls = (countdownUrl: string, activatedUrl: string) => {
  if (stateRef) return update(stateRef, { countdownUrl, activatedUrl, timestamp: getServerTime() });
  localState = { ...localState, countdownUrl, activatedUrl, timestamp: getServerTime() };
  localListeners.forEach(l => l(localState));
};

export const resetSystem = () => {
  const resetState = { ...INITIAL_STATE, timestamp: getServerTime() };
  if (stateRef) return set(stateRef, resetState);
  localState = resetState;
  localListeners.forEach(l => l(localState));
};

export const isFirebaseConnected = () => isConfigValid && !!storage;
