import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, onDisconnect, push, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { AppState, INITIAL_STATE } from '../types.ts';

// Cấu hình Firebase cho dự án: kickoffai
const firebaseConfig = {
  apiKey: "AIzaSyCu1q7vYsj7y-qKK5GQOrT0aOe5OT1SdqU",
  authDomain: "kickoffai.firebaseapp.com",
  databaseURL: "https://kickoffai-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kickoffai",
  storageBucket: "kickoffai.firebasestorage.app",
  messagingSenderId: "861461142168",
  appId: "1:861461142168:web:3d64ab128f0698032a8eed",
  measurementId: "G-RMCX2NSLTE"
};

let app: FirebaseApp;
let db: Database | null = null;
let storage: FirebaseStorage | null = null;
let serverTimeOffset = 0;

try {
  // Chỉ khởi tạo 1 lần duy nhất
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  // Khởi tạo các service
  db = getDatabase(app);
  storage = getStorage(app);
  
  if (typeof window !== 'undefined') {
    // Check if analytics is supported before initializing to avoid cookie errors
    isSupported().then((supported) => {
      if (supported) {
        getAnalytics(app);
      }
    }).catch((err) => {
      console.warn("Firebase Analytics not supported in this environment:", err);
    });
  }
  
  console.log("🚀 Firebase Initialization: Success (kickoffai)");

  const offsetRef = ref(db, ".info/serverTimeOffset");
  onValue(offsetRef, (snap) => {
    serverTimeOffset = snap.val() || 0;
  });
} catch (error) {
  console.error("❌ Firebase Critical Error:", error);
}

const stateRef = db ? ref(db, 'eventState') : null;
const connectionsRef = db ? ref(db, 'activeConnections') : null;

export { storage, db };

export const getServerTime = () => Date.now() + serverTimeOffset;

export const trackDevice = () => {
  if (!db || !connectionsRef) return;
  
  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      const myConnectionRef = push(connectionsRef);
      onDisconnect(myConnectionRef).update({
        online: false,
        lastSeen: getServerTime()
      });
      set(myConnectionRef, {
        online: true,
        lastSeen: getServerTime(),
        userAgent: navigator.userAgent,
        connectedAt: getServerTime()
      });
    }
  });
};

export const syncDeviceStats = (callback: (stats: { online: number, offline: number }) => void) => {
  if (!connectionsRef) return () => {};
  return onValue(connectionsRef, (snap) => {
    const data = snap.val();
    let online = 0;
    let offline = 0;
    
    if (data) {
      Object.values(data).forEach((device: any) => {
        if (device.online === true) online++;
        else offline++;
      });
    }
    callback({ online, offline });
  });
};

export const syncState = (callback: (state: AppState) => void) => {
  if (!stateRef) {
    // Nếu không kết nối được Firebase, dùng state mặc định để app không bị trắng trang
    console.warn("⚠️ Firebase Sync Warning: Running in offline/demo mode.");
    callback({ ...INITIAL_STATE, timestamp: Date.now() });
    return () => {};
  }
  
  return onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const keys = Object.keys(INITIAL_STATE) as Array<keyof AppState>;
      const isMissingFields = keys.some(key => data[key] === undefined);

      if (isMissingFields) {
        const healedData = { ...INITIAL_STATE, ...data };
        set(stateRef, healedData);
        callback(healedData);
      } else {
        callback(data);
      }
    } else {
      console.log("🆕 Initializing default state...");
      const initial = { ...INITIAL_STATE, timestamp: getServerTime() };
      set(stateRef, initial);
      callback(initial);
    }
  }, (error) => {
    console.error("❌ Firebase Sync Error:", error);
  });
};

export const updateStatus = (status: AppState['status']) => {
  if (stateRef) return update(stateRef, { status, timestamp: getServerTime() });
};

export const updateEventConfig = (config: Partial<AppState>) => {
  if (stateRef) return update(stateRef, { ...config, timestamp: getServerTime() });
};

export const isFirebaseConnected = () => !!db;