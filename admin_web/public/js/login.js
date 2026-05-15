// ログイン処理
/* document.addEventListener("DOMContentLoaded", function() {
    document.querySelector(".login-form").addEventListener("submit", async function(e) {
    e.preventDefault(); // ページリロード防止

    const id = document.getElementById("userId").value.trim();
    const password = document.getElementById("password").value;

    try{
        const response = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ id, password })
        });

        // 入力値チェック
        if (!id || !password) {
            return res.json({ success: false, message: "IDとパスワードを入力してください" });
        }
        const result = await response.json();

        // HTTPエラー(500など)を検知
        if (!response.ok) {
            throw new Error(`サーバーエラー: ${response.status}`);
        }

        if (result.success) {
            window.location.href = "index.html";
        } else {
            alert("IDまたはパスワードが違います");
        }

    } catch (error) {
        alert("通信エラー");
        console.error(error);
    }
});
}); */

function checkLogin() {
    document.querySelector(".login-form").addEventListener("submit", function(e) {
    e.preventDefault(); // ページリロード防止

    const id = document.getElementById("userId").value;
    const password = document.getElementById("password").value;

    // 仮の認証
    if (id === "admin" && password === "1234") {
        // ログイン成功
        window.location.href = "index.html";
    } else {
        // ログイン失敗
        alert("IDまたはパスワードが違います");
    }
    })
}

document.addEventListener("DOMContentLoaded", checkLogin);