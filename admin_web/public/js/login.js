import { showError } from "./style.js";

// ログイン処理
document.addEventListener("DOMContentLoaded", function () {

    document.querySelector(".login-form").addEventListener("submit", async function (e) {
        e.preventDefault();

        const mail_address = document.getElementById("mail_address").value.trim();
        const password_hash = document.getElementById("password_hash").value;

        if (!mail_address || !password_hash) {
            showError("メールアドレスとパスワードを入力してください");
            return;
        }

        if (!isValidEmail(mail_address)) {
            showError("メールアドレスの形式が正しくありません");
            return;
        }

        try {
            const user = await authenticate(mail_address, password_hash); // ← ここだけ意識する
            sessionStorage.setItem("uid", user.uid);
            window.location.href = "./home.html";
        } catch (error) {
            showError("メールアドレスまたはパスワードが違います");
            console.error(error);
        }
    });
});

function isValidEmail(mail_address) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail_address);
}

// ────────────────────────────────────────────────
//   認証処理（ここだけ差し替えれば認証方式を切替可能）
// ────────────────────────────────────────────────
// 現在: server.js の /login（Firestore + bcryptハッシュ比較）を呼んでいる
// 将来: Firebase Authentication に切り替える場合は、この関数の中身だけを
//       signInWithEmailAndPassword(auth, login_id, password) を使う実装に
//       差し替える。呼び出し側（上のsubmitハンドラ）は変更不要。
// ────────────────────────────────────────────────
async function authenticate(mail_address, password_hash) {
    const res = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mail_address, password_hash }),
    });
 
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "ログインに失敗しました");
    }
 
    const data = await res.json();
    // { success: true, uid, name } を想定
    return { uid: data.uid, name: data.name };
}