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

// 移行時はこの関数の中身だけ書き換える
async function authenticate(login_id, password) {

    // --- Firebase移行時はここをごっそり差し替える ---
    const response = await fetch("http://localhost:3000/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ login_id, password })
    });
    if (!response.ok) throw new Error(`読み込みエラー: ${response.status}`);

    const data = await response.json();
    return { uid: data.login_id, name: data.name };
    // ------------------------------------------------
}