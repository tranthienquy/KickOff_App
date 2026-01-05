
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, Database, onDisconnect, push } from 'firebase/database';
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
    
    const offsetRef = ref(db, ".info/serverTimeOffset");
    onValue(offsetRef, (snap) => {
      serverTimeOffset = snap.val() || 0;
    });

  } catch (error) {
    console.error("❌ Firebase Init Error:", error);
  }
}

const stateRef = db ? ref(db, 'eventState') : null;
const connectionsRef = db ? ref(db, 'activeConnections') : null;

export { storage };

export const getServerTime = () => Date.now() + serverTimeOffset;

// Theo dõi thiết bị kết nối
export const trackDevice = () => {
  if (!db || !connectionsRef) return;
  
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      const myConnectionRef = push(connectionsRef);
      // Khi mất kết nối, tự động xóa node này
      onDisconnect(myConnectionRef).remove();
      // Đánh dấu thiết bị đang online
      set(myConnectionRef, {
        lastSeen: getServerTime(),
        userAgent: navigator.userAgent
      });
    }
  });
};

// Lấy số lượng thiết bị đang online
export const syncDeviceCount = (callback: (count: number) => void) => {
  if (!connectionsRef) return () => {};
  return onValue(connectionsRef, (snap) => {
    const data = snap.val();
    callback(data ? Object.keys(data).length : 0);
  });
};

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

export const isFirebaseConnected = () => isConfigValid && !!storage;
