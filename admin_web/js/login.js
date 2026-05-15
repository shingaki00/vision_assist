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