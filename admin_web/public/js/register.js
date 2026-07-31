import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

// ⚠️ 【重要】ご自身のFirebaseプロジェクトの設定値に書き換えてください
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const messageEl = document.getElementById('message');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // メッセージの初期化
        messageEl.textContent = '';
        messageEl.className = 'message';

        // 入力値の取得
        const facilityName = document.getElementById('facility_name').value.trim();
        const email = document.getElementById('register_email').value.trim();
        const password = document.getElementById('password').value;
        const passwordConfirm = document.getElementById('password_confirm').value;

        // フロントエンド側の簡易バリデーション
        if (!facilityName || !email || !password || !passwordConfirm) {
            showMessage('すべての項目を入力してください。', 'error');
            return;
        }

        if (password !== passwordConfirm) {
            showMessage('パスワードと確認用パスワードが一致しません。', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('パスワードは6文字以上で入力してください。', 'error');
            return;
        }

        try {
            // アカウント作成中の状態表示
            showMessage('アカウントを作成中...', 'success');

            // 1. Firebase Authentication でアカウント作成
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Firestore の `managers` コレクションに施設名などの追加情報を保存
            // ドキュメントIDに Authentication の uid を使用することで紐付けを行います
            await setDoc(doc(db, "managers", user.uid), {
                facilityName: facilityName,
                email: email,
                createdAt: new Date(),
                role: "admin" // 必要に応じて権限を設定
            });

            // 登録成功時の処理
            showMessage('管理者アカウントの登録が完了しました！ログイン画面へ移動します。', 'success');
            
            // 2秒後にログイン画面へ自動遷移
            setTimeout(() => {
                window.location.href = './index.html';
            }, 2000);

        } catch (error) {
            console.error('Firebase登録エラー:', error);
            
            // Firebaseのエラーコードに応じた日本語メッセージ変換
            let errorMessage = 'アカウントの作成に失敗しました。';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'このメールアドレスは既に登録されています。';
                    break;
                case 'auth/invalid-email':
                    errorMessage = '無効なメールアドレス形式です。';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'パスワードが短すぎます（6文字以上必要です）。';
                    break;
                case 'firestore/permission-denied':
                    errorMessage = 'データベースへの保存権限がありません。Firestoreのルールを確認してください。';
                    break;
            }
            showMessage(errorMessage, 'error');
        }
    });

    // メッセージ表示用ユーティリティ関数
    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
    }
});