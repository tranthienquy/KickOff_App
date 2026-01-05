
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, Database } from 'firebase/database';
import { AppState, INITIAL_STATE } from '../types';

// ==========================================================
// Cấu hình Firebase - Đã cập nhật với Key thực tế của bạn
// ==========================================================
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

// Kiểm tra xem đã cấu hình Key chưa (Dựa trên giá trị mặc định ban đầu)
const isConfigValid = firebaseConfig.apiKey !== "YOUR_API_KEY" && firebaseConfig.apiKey !== "";

let db: Database | null = null;
if (isConfigValid) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log("Firebase initialized successfully with real credentials.");
  } catch (error) {
    console.error("Firebase Init Error:", error);
  }
}

const stateRef = db ? ref(db, 'eventState') : null;

// Local state cho chế độ Demo khi chưa có Firebase hoặc lỗi kết nối
let localState = { ...INITIAL_STATE };
let localListeners: ((state: AppState) => void)[] = [];

export const syncState = (callback: (state: AppState) => void) => {
  if (stateRef) {
    return onValue(stateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        callback(data);
      } else {
        // Khởi tạo state mặc định nếu Database trống
        set(stateRef, INITIAL_STATE);
        callback(INITIAL_STATE);
      }
    }, (error) => {
      console.error("Firebase Read Error:", error);
      // Fallback to local if error occurs
      callback(localState);
    });
  } else {
    // Chế độ Demo Offline
    setTimeout(() => callback(localState), 0);
    localListeners.push(callback);
    return () => { localListeners = localListeners.filter(l => l !== callback); };
  }
};

export const updateStatus = (status: AppState['status']) => {
  if (stateRef) {
    return update(stateRef, { status, timestamp: Date.now() });
  } else {
    localState = { ...localState, status, timestamp: Date.now() };
    localListeners.forEach(l => l(localState));
  }
};

export const updateUrls = (countdownUrl: string, activatedUrl: string) => {
  if (stateRef) {
    return update(stateRef, { countdownUrl, activatedUrl, timestamp: Date.now() });
  } else {
    localState = { ...localState, countdownUrl, activatedUrl, timestamp: Date.now() };
    localListeners.forEach(l => l(localState));
  }
};

export const resetSystem = () => {
  if (stateRef) {
    return set(stateRef, INITIAL_STATE);
  } else {
    localState = { ...INITIAL_STATE };
    localListeners.forEach(l => l(localState));
  }
};

export const isFirebaseConnected = () => isConfigValid;
