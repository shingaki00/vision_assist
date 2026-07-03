import { showError } from "./style.js";

// ログイン処理
document.addEventListener("DOMContentLoaded", function () {

    document.querySelector(".login-form").addEventListener("submit", async function (e) {
        e.preventDefault();

        const login_id = document.getElementById("login_id").value.trim();
        const password = document.getElementById("password").value;

        if (!login_id || !password) {
            showError("IDとパスワードを入力してください");
            return;
        }

        if (!isValidEmail(login_id)) {
            showError("メールアドレスの形式が正しくありません");
            return;
        }

        try {
            const user = await authenticate(login_id, password); // ← ここだけ意識する
            sessionStorage.setItem("uid", user.uid);
            window.location.href = "./home.html";
        } catch (error) {
            showError("IDまたはパスワードが違います");
            console.error(error);
        }
    });
});

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ────────────────────────────────────────────────
//   認証処理（ここだけ差し替えれば認証方式を切替可能）
// ────────────────────────────────────────────────
// 現在: server.js の /login（Firestore + bcryptハッシュ比較）を呼んでいる
// 将来: Firebase Authentication に切り替える場合は、この関数の中身だけを
//       signInWithEmailAndPassword(auth, login_id, password) を使う実装に
//       差し替える。呼び出し側（上のsubmitハンドラ）は変更不要。
// ────────────────────────────────────────────────
async function authenticate(login_id, password) {
    const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id, password }),
    });
 
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "ログインに失敗しました");
    }
 
    const data = await res.json();
    // { success: true, uid, name } を想定
    return { uid: data.uid, name: data.name };
}