import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAocBKyYyVQ1ESZOrpsNOOFeSCpz_JaNa4",
  authDomain: "areej-makkah.firebaseapp.com",
  projectId: "areej-makkah",
  storageBucket: "areej-makkah.firebasestorage.app",
  messagingSenderId: "695330967649",
  appId: "1:695330967649:web:e1efb35abe068f88f9da20"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
