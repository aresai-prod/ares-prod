// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAGhTjWx4mbO0qZWxS6yN6Dd-4s-HL4dMQ",
  authDomain: "aresai-production.firebaseapp.com",
  projectId: "aresai-production",
  storageBucket: "aresai-production.firebasestorage.app",
  messagingSenderId: "64286327467",
  appId: "1:64286327467:web:bb3b5ced0e1d716273adee",
  measurementId: "G-SRMZ67LT3H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);