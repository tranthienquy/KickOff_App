
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

if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    storage = getStorage(app);
    console.log("✅ Firebase initialized. Storage Bucket:", firebaseConfig.storageBucket);
  } catch (error) {
    console.error("❌ Firebase Init Error:", error);
  }
}

const stateRef = db ? ref(db, 'eventState') : null;

export { storage };

let localState = { ...INITIAL_STATE };
let localListeners: ((state: AppState) => void)[] = [];

export const syncState = (callback: (state: AppState) => void) => {
  if (stateRef) {
    return onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) callback(data);
      else {
        set(stateRef, INITIAL_STATE);
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
  if (stateRef) return update(stateRef, { status, timestamp: Date.now() });
  localState = { ...localState, status, timestamp: Date.now() };
  localListeners.forEach(l => l(localState));
};

export const updateUrls = (countdownUrl: string, activatedUrl: string) => {
  if (stateRef) return update(stateRef, { countdownUrl, activatedUrl, timestamp: Date.now() });
  localState = { ...localState, countdownUrl, activatedUrl, timestamp: Date.now() };
  localListeners.forEach(l => l(localState));
};

export const resetSystem = () => {
  if (stateRef) return set(stateRef, INITIAL_STATE);
  localState = { ...INITIAL_STATE };
  localListeners.forEach(l => l(localState));
};

export const isFirebaseConnected = () => isConfigValid && !!storage;
