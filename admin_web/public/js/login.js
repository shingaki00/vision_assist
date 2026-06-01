// ログイン処理
document.addEventListener("DOMContentLoaded", function() {
    document.querySelector(".login-form").addEventListener("submit", async function(e) {
    e.preventDefault(); // ページリロード防止

    const login_id = document.getElementById("login_id").value.trim();
    const password = document.getElementById("password").value;


    // 入力値チェック
    if (!login_id || !password) {
        alert("IDとパスワードを入力してください");
        return;
    }

    try {
        // JSONファイルを直接読み込む
        const response = await fetch("../testData.json");
        const data = await response.json();

        const admin = data.admins.find(a => a.login_id === login_id);

        if (admin && admin.password === password) {
            sessionStorage.setItem("loggedInUser", JSON.stringify(admin)); //sessionStorageにユーザ情報を保存
            window.location.href = "home.html";
        } else {
            alert("IDまたはパスワードが違います");
        }

    } catch (error) {
        alert("読み込みエラー");
        console.error(error);
    }

    // HTTPエラー(500など)を検知
    if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
    }

    if (result.success) {
        window.location.href = "home.html";
    } else {
        alert("IDまたはパスワードが違います");
    }

});
});