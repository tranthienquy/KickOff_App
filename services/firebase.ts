
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { AppState, INITIAL_STATE } from '../types';

// NOTE: Replace these with your actual Firebase project config from the Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  databaseURL: "https://your-project-id-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const storage = getStorage(app);
const stateRef = ref(db, 'eventState');

export const syncState = (callback: (state: AppState) => void) => {
  return onValue(stateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    } else {
      // Initialize if empty
      set(stateRef, INITIAL_STATE);
      callback(INITIAL_STATE);
    }
  });
};

export const updateStatus = (status: AppState['status']) => {
  return update(stateRef, { status, timestamp: Date.now() });
};

export const updateUrls = (countdownUrl: string, activatedUrl: string) => {
  return update(stateRef, { countdownUrl, activatedUrl, timestamp: Date.now() });
};

export const resetSystem = () => {
  return set(stateRef, INITIAL_STATE);
};

export const uploadVideo = async (file: File, path: string): Promise<string> => {
  const fileRef = storageRef(storage, `videos/${path}_${Date.now()}_${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};
