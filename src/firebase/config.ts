// ---------------------------------------------------------------------------
// Firebase 설정
// 1. https://console.firebase.google.com 에서 프로젝트 생성 (PokéSet 프로젝트 재사용도 가능)
// 2. 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가 → firebaseConfig 값을 아래에 붙여넣기
// 3. Authentication > Sign-in method > 이메일/비밀번호 활성화
// 4. Realtime Database 생성 → 규칙은 README의 보안 규칙 참고
// ---------------------------------------------------------------------------

import { initializeApp, type FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyD4OeYsZZi8nKjIy_Dn8k5r_5fudFb36v4',
  authDomain: 'draft-poker.firebaseapp.com',
  databaseURL: 'https://draft-poker-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'draft-poker',
  storageBucket: 'draft-poker.firebasestorage.app',
  messagingSenderId: '944080171691',
  appId: '1:944080171691:web:69a2050af2f4d546da3dee',
};

export function isFirebaseConfigured(): boolean {
  return !firebaseConfig.apiKey.startsWith('PASTE');
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}
