import { formatTimeAgo } from "./style.js";

// ─────────────────────────────────────────────
// サマリーカードの描画
// ─────────────────────────────────────────────

async function fetchSummary() {
    const res = await fetch("../testData.json");
    const { patients, walkingLogs } = await res.json();

    const today = new Date().toISOString().slice(0, 10); // "2026-06-10"

    // 今週の範囲を計算
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // 総ユーザー数
    const totalUsers = patients.length;

    // 本日の歩行ログ数
    const todayLogs = walkingLogs.filter(log =>
        log.start_time.slice(0, 10) === today
    );
    const todayLogCount = todayLogs.length;

    // 本日のアクティブユーザー（今日ログがあるユニークなpatient_id）
    const activeUserIds = new Set(todayLogs.map(log => log.patient_id));
    const activeUserCount = activeUserIds.size;

    // 週間利用率（今週ログがある患者 ÷ 全患者）
    const weeklyActiveIds = new Set(
        walkingLogs
            .filter(log => new Date(log.start_time) >= weekAgo)
            .map(log => log.patient_id)
    );
    const weeklyRate = Math.round((weeklyActiveIds.size / patients.length) * 100);

    return { totalUsers, activeUserCount, todayLogCount, weeklyRate };
}

function renderSummary({ totalUsers, activeUserCount, todayLogCount, weeklyRate }) {
    document.querySelector(".summary-card:nth-child(1) .summary-value").textContent
        = totalUsers.toLocaleString();
    document.querySelector(".summary-card:nth-child(2) .summary-value").textContent
        = activeUserCount.toLocaleString();
    document.querySelector(".summary-card:nth-child(3) .summary-value").textContent
        = todayLogCount.toLocaleString();
    document.querySelector(".summary-card:nth-child(4) .summary-value").textContent
        = weeklyRate + "%";
}


//　------ 以下ホーム画面通知の処理 -------

// ─────────────────────────────────────────────
// データソースを取得（将来 localStorage に差し替えここだけ変更）
// ─────────────────────────────────────────────
const STORAGE_KEY = "activities";

/**
 * アクティビティ一覧を取得する
 * 将来 localStorage に移行する場合はこの関数の中身を差し替えるだけでOK：
 *   const raw = localStorage.getItem(STORAGE_KEY);
 *   return raw ? JSON.parse(raw) : [];
*/
async function fetchActivities() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
        // localStorage にデータがあればそちらを優先
        return JSON.parse(raw);
    }
    // なければ testData.json から取得してキャッシュ
    const res = await fetch("../testData.json");
    const { activities } = await res.json();
 
    // id・read が未付与の場合は自動付与
    const normalized = activities.map((item, i) => ({
        id:   item.id   ?? i + 1,
        read: item.read ?? false,
        ...item,
    }));
 
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
}


/** localStorage を更新する */
function saveActivities(activities) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

/** 1件を既読にして保存 */
function markAsRead(id) {
    const activities = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const updated = activities.map(a => a.id === id ? { ...a, read: true } : a);
    saveActivities(updated);
}
 
/** 全件既読にして保存 */
function markAllAsRead() {
    const activities = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    saveActivities(activities.map(a => ({ ...a, read: true })));
}
 
/** 未読件数を返す */
function getUnreadCount(activities) {
    return activities.filter(a => !a.read).length;
}


// ─────────────────────────────────────────────
// レンダリング
// ─────────────────────────────────────────────

/** バッジを更新する（未読件数を集計） */
function updateBadge(activities) {
    const badge = document.getElementById("unread-badge");
    if (!badge) return;
    const cnt = getUnreadCount(activities);
    badge.textContent = cnt;
    badge.hidden = cnt === 0;
}

/** リストを描画する */
async function renderActivities() {
    const activities = await fetchActivities();
    const list = document.getElementById("activity-list");
    list.innerHTML = "";
 
    // 最新5件
    const latest = [...activities]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, 5);
 
    latest.forEach(item => {
        const li = document.createElement("li");
        li.classList.add("activity-item");
        if (!item.read) li.classList.add("unread");
        li.dataset.id = item.id;
 
        li.innerHTML = `
            <div class="activity-text">
                <p class="activity-title">${item.title}</p>
                <p class="activity-desc">${item.description}</p>
            </div>
            <span class="activity-time">${formatTimeAgo(item.time)}</span>
            ${!item.read ? '<span class="unread-dot" aria-label="未読"></span>' : ""}
        `;
 
        // クリックで詳細モーダルを開く & 既読化
        li.addEventListener("click", () => {
            openModal(item);
            markAsRead(item.id);
        });
        list.appendChild(li);
    });
    updateBadge(activities);
}


// ─────────────────────────────────────────────
// モーダル
// ─────────────────────────────────────────────
function openModal(item) {
    // 既読化
    markAsRead(item.id);
 
    // モーダルがなければ動的生成
    const overlay = document.getElementById("activity-modal-overlay");
 
    overlay.querySelector("#modal-title").textContent  = item.title;
    overlay.querySelector("#modal-desc").textContent   = item.description;
    overlay.querySelector("#modal-time").textContent   = formatTimeAgo(item.time);
 
    overlay.classList.add("open");
 
    // リストを再描画して既読ドットを消す
    renderActivities();
}
 
function closeModal() {
    const overlay = document.getElementById("activity-modal-overlay");
    if (overlay) overlay.classList.remove("open");
}

async function openAllModal() {
    const activities = await fetchActivities();
    const sorted = [...activities].sort((a, b) => new Date(b.time) - new Date(a.time));

    const overlay = document.getElementById("activity-modal-overlay");
    overlay.querySelector("#modal-title").textContent = "すべてのアクティビティ";
    overlay.querySelector("#modal-desc").innerHTML = sorted.map(item => `
        <div class="all-activity-item">
            <div>
                <p class="activity-title">${item.title}</p>
                <p class="activity-desc">${item.description}</p>
            </div>
            <span class="activity-time">${formatTimeAgo(item.time)}</span>
        </div>
    `).join("");
    overlay.querySelector("#modal-time").textContent = `全${sorted.length}件`;
    overlay.classList.add("open");
}


// ─────────────────────────────────────────────
// 「すべて既読」ボタン（HTML側に id="btn-mark-all" があれば動く）
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    renderActivities();
    fetchSummary().then(renderSummary);

    // モーダルの閉じる処理（HTML側に書いたので、ここでイベントを登録）
    const overlay = document.getElementById("activity-modal-overlay");
    overlay.querySelector(".modal-close").addEventListener("click", closeModal);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
    document.getElementById("btn-show-all").addEventListener("click", () => { openAllModal(); });
 
    const btnMarkAll = document.getElementById("btn-mark-all");
    if (btnMarkAll) {
        btnMarkAll.addEventListener("click", async () => {
            markAllAsRead();
            await renderActivities();
        });
    }
});