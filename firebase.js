// Pizza Planet - Firebase setup shared by every page.
// Paste your own config from Firebase console > Project settings > Your apps > Web app.
// These values are safe to be public. The Firestore rules are what protect your data.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC_mFmwhbx_xSB0rAdZBTiNA3XuUKipz4w",
    authDomain: "pool-f7879.firebaseapp.com",
    projectId: "pool-f7879",
    storageBucket: "pool-f7879.firebasestorage.app",
    messagingSenderId: "519231473414",
    appId: "1:519231473414:web:5fcf35b54c6033a1c78087"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-exported so other files don't need to repeat the CDN address
export {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// A user is an admin only if a document exists at admins/{their uid}.
// Only you can create that document (in the Firebase console), see firestore.rules.
export async function isAdmin(user)
{
  if (!user)
  {
    return false;
  }

  try
  {
    const snap = await getDoc(doc(db, "admins", user.uid));
    return snap.exists();
  }
  catch (err)
  {
    return false;
  }
}