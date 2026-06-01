import { formatTimeAgo } from "./style.js";

// 最新５件の通知を取得する
async function renderActivities() {
    const res = await fetch("../testData.json");
    const { activities } = await res.json();

    const list = document.getElementById("activity-list");
    list.innerHTML = "";

    // 最新5件だけ取得
    const latest = activities
                    .sort((a, b) => new Date(b.time) - new Date(a.time))
                    .slice(0, 5);

    latest.forEach(item => {
        const li = document.createElement("li");
        li.classList.add("activity-item");

        //本番はtextContent使うのが安全ですが、今回は見た目重視でinnerHTMLを使用
        li.innerHTML = `
            <div class="activity-text">
                <p class="activity-title">${item.title}</p>
                <p class="activity-desc">${item.description}</p>
            </div>
            <span class="activity-time">${formatTimeAgo(item.time)}</span>
        `;

        list.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", renderActivities);