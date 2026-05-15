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

fetch("header.html")
  .then(response => response.text())
  .then(data => {
    document.getElementById("header").innerHTML = data;
  });