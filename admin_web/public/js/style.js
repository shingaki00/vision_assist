// header.htmlを読み込む
document.addEventListener("DOMContentLoaded", () => {
    const headerEl = document.getElementById("header");
    if (!headerEl) return;

    const scriptSrc = document.querySelector('script[src*="style.js"]')?.src;
    const headerPath = scriptSrc
        ? new URL("../header.html", scriptSrc).href
        : "../header.html";

    fetch(headerPath)
        .then(res => res.text())
        .then(data => {
        headerEl.innerHTML = data;
        Logout();
        })
        .catch(err => console.error("ヘッダーの読み込みに失敗しました:", err));
});


// 時間を「〇分前」などの形式で表示する関数
export function formatTimeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);

    const diffMs = now - past; // ミリ秒差
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    if (diffHour < 24) return `${diffHour}時間前`;
    return `${diffDay}日前`;
}


// ログアウト処理
export function Logout() {
    const logoutBtn = document.querySelector(".btn-logout");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            const confirmed = confirm("ログアウトしますか？"); // ← 追加
            if (!confirmed) return;                            // ← キャンセルで中断

            sessionStorage.removeItem("loggedInUser");
            window.location.href = "../public/login.html";
        });
    }
}
document.addEventListener("DOMContentLoaded", () => { Logout();});
