import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, child } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
};

if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL) {
  throw new Error(
    "Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_DATABASE_URL in environment"
  );
}

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, get, set, child };
