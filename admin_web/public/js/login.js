import { showError } from "./style.js";

// ログイン処理
document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector(".login-form");
    if (!form) return;

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const mail_address = document.getElementById("mail_address").value.trim();
        const password_hash = document.getElementById("password_hash").value;

        console.log("[login] submit", {
            mail_address,
            password_length: password_hash.length,
            hasPassword: Boolean(password_hash),
        });

        if (!mail_address || !password_hash) {
            console.warn("[login] missing credentials");
            showError("メールアドレスとパスワードを入力してください");
            return;
        }

        if (!isValidEmail(mail_address)) {
            console.warn("[login] invalid email format", mail_address);
            showError("メールアドレスの形式が正しくありません");
            return;
        }

        try {
            const user = await authenticate(mail_address, password_hash);
            console.log("[login] authentication success", user);
            sessionStorage.setItem("uid", user.uid);
            window.location.href = "./home.html";
        } catch (error) {
            console.error("[login] authentication failed", error);
            showError("メールアドレスまたはパスワードが違います");
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
    console.log("[login] sending auth request", {
        mail_address,
        password_length: password_hash.length,
    });

    const res = await fetch("http://localhost:3000/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            mail_address,
            password_hash,
        }),
    });

    console.log("[login] received response", {
        status: res.status,
        statusText: res.statusText,
    });
 
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[login] server error body", body);
        throw new Error(body.message || "ログインに失敗しました");
    }
 
    const data = await res.json();
    console.log("[login] response payload", data);
    return { uid: data.uid, name: data.name };
}