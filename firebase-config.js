// Replace this with YOUR web app config from Firebase Console:
// Project settings (gear icon) → General tab → scroll to "Your apps" →
// if no web app yet, click the </> icon to add one → copy the firebaseConfig object here.
export const firebaseConfig = {
  apiKey: "AIzaSyBZRQuUAB_oDKceY6nmQlPXUgXGrM1nZTM",
  authDomain: "rustech-subscriber-tracker.firebaseapp.com",
  projectId: "rustech-subscriber-tracker",
  storageBucket: "rustech-subscriber-tracker.firebasestorage.app",
  messagingSenderId: "306366164792",
  appId: "1:306366164792:web:bd93d64ce0355a986b5bcd"
};

// Only these email(s) are allowed to use this dashboard as admin.
// Add your own email(s) here (create a SEPARATE Firebase Auth account for
// this — don't reuse a subscriber test account like rinceghrio@gmail.com).
export const ADMIN_EMAILS = [
  "rustyminge784@gmail.com"
];
