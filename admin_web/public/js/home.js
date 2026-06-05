import { formatTimeAgo } from "./style.js";

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


// ─────────────────────────────────────────────
// 「すべて既読」ボタン（HTML側に id="btn-mark-all" があれば動く）
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    renderActivities();

    // モーダルの閉じる処理（HTML側に書いたので、ここでイベントを登録）
    const overlay = document.getElementById("activity-modal-overlay");
    overlay.querySelector(".modal-close").addEventListener("click", closeModal);
    overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
 
    const btnMarkAll = document.getElementById("btn-mark-all");
    if (btnMarkAll) {
        btnMarkAll.addEventListener("click", async () => {
            markAllAsRead();
            await renderActivities();
        });
    }
});