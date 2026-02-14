import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyB1Dte4oGdFtmDIDA875Sx3aL5W4ukiofk",
  authDomain: "video-chat-app-313c2.firebaseapp.com",
  projectId: "video-chat-app-313c2",
  storageBucket: "video-chat-app-313c2.firebasestorage.app",
  messagingSenderId: "114866651055",
  appId: "1:114866651055:web:9c798f9a5d524302a4795a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);