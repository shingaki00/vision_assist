import { formatTimeAgo } from "./style.js";

// ─────────────────────────────────────────────
// サマリーカードの描画
// ─────────────────────────────────────────────

async function fetchSummary() {
  const [patients, walkingLogs] = await Promise.all([
    fetch("http://localhost:3000/users").then((r) => r.json()),
    fetch("http://localhost:3000/walkingLogs").then((r) => r.json()),
  ]);

  const today = new Date().toISOString().slice(0, 10); // "2026-06-10"

  // 今週の範囲を計算
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  // 総ユーザー数
  const totalUsers = patients.length;

  // 本日の歩行ログ数
  const todayLogs = walkingLogs.filter(
    (log) => log.start_time.slice(0, 10) === today,
  );
  const todayLogCount = todayLogs.length;

  // 本日のアクティブユーザー（今日ログがあるユニークなpatient_id）
  const activeUserIds = new Set(todayLogs.map((log) => log.patient_id));
  const activeUserCount = activeUserIds.size;

  // 週間利用率（今週ログがある患者 ÷ 全患者）
  const weeklyActiveIds = new Set(
    walkingLogs
      .filter((log) => new Date(log.start_time) >= weekAgo)
      .map((log) => log.patient_id),
  );
  const weeklyRate = Math.round((weeklyActiveIds.size / patients.length) * 100);

  return { totalUsers, activeUserCount, todayLogCount, weeklyRate };
}

function renderSummary({
  totalUsers,
  activeUserCount,
  todayLogCount,
  weeklyRate,
}) {
  document.querySelector(
    ".summary-card:nth-child(1) .summary-value",
  ).textContent = totalUsers.toLocaleString();
  document.querySelector(
    ".summary-card:nth-child(2) .summary-value",
  ).textContent = activeUserCount.toLocaleString();
  document.querySelector(
    ".summary-card:nth-child(3) .summary-value",
  ).textContent = todayLogCount.toLocaleString();
  document.querySelector(
    ".summary-card:nth-child(4) .summary-value",
  ).textContent = weeklyRate + "%";
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
  try {
    const response = await fetch("http://localhost:3000/notifications");

    if (!response.ok) {
      throw new Error("通信の取得に失敗しました");
    }

    return await response.json();
  } catch (error) {
    console.error("エラー:", error);
    return [];
  }
}

/** localStorage を更新する */
function saveActivities(activities) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

/** 1件を既読にして保存 */
async function markAsRead(id) {
  try {
    const response = await fetch(
      `http://localhost:3000/notifications/${encodeURIComponent(id)}/read`,
      {
        method: "PATCH",
      },
    );

    if (!response.ok) {
      throw new Error("既読更新に失敗しました");
    }

    // サーバーから最新データを取得して再表示
    await renderActivities();
  } catch (error) {
    console.error("既読更新エラー:", error);
  }
}

/** 全件既読にして保存 */
async function markAllAsRead() {
  try {
    const response = await fetch(
      "http://localhost:3000/notifications/read-all",
      {
        method: "PATCH",
      },
    );

    if (!response.ok) {
      throw new Error("全件既読に失敗しました");
    }

    await renderActivities();
  } catch (error) {
    console.error("全件既読エラー:", error);
  }
}

/** 未読件数を返す */
function getUnreadCount(activities) {
  return activities.filter((a) => !a.read).length;
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
  // 取得したデータが配列か確認
  if (!Array.isArray(activities)) {
    console.error("通知データが配列ではありません:", activities);
    return;
  }

  const list = document.getElementById("activity-list");
  list.innerHTML = "";

  // 最新5件
  const latest = [...activities]
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 5);

  latest.forEach((item) => {
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
    li.addEventListener("click", async () => {
      openModal(item);
      await markAsRead(item.id);
      // await renderActivities(updatedActivities);
    });
    list.appendChild(li);
  });
  updateBadge(activities);
}

// HTMLの読み込みが完了したら実行
document.addEventListener("DOMContentLoaded", () => {
  renderActivities();
});

// ─────────────────────────────────────────────
// モーダル
// ─────────────────────────────────────────────
function openModal(item) {
  // 既読化
  markAsRead(item.id);

  // モーダルがなければ動的生成
  const overlay = document.getElementById("activity-modal-overlay");

  // 1件の通知を表示するモード
  overlay.dataset.mode = "single";
  // ページ切り替え部分を非表示
  overlay.querySelector("#pagination").style.display = "none";

  overlay.querySelector("#modal-title").textContent = item.title;
  overlay.querySelector("#modal-desc").textContent = item.description;
  overlay.querySelector("#modal-time").textContent = formatTimeAgo(item.time);

  overlay.classList.add("open");

  // リストを再描画して既読ドットを消す
  renderActivities();
}

function closeModal() {
  const overlay = document.getElementById("activity-modal-overlay");
  if (overlay) overlay.classList.remove("open");
}

let currentPage = 1;
const pageSize = 5;
let activities = [];
async function openAllModal() {
  activities = await fetchActivities();
  const sorted = [...activities].sort(
    (a, b) => new Date(b.time) - new Date(a.time),
  );

  const totalPages = Math.ceil(activities.length / pageSize);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // 現在のページに表示する通知だけ取得
  const displayActivities = sorted.slice(startIndex, endIndex);

  const overlay = document.getElementById("activity-modal-overlay");
  // 全通知モーダルであることを記録
  overlay.dataset.mode = "all";

  // ページ切り替え部分を表示
  overlay.querySelector("#pagination").style.display = "flex";
  overlay.querySelector("#modal-title").textContent = "すべてのアクティビティ";

  // console.log("displayActivities:", displayActivities);
  // console.log("1件目の通知:", displayActivities[0]);
  const list = displayActivities
    .map(
      (item) => `
        <div class="all-activity-item">
            <div>
                <p class="activity-title">${item.title}</p>
                <p class="activity-desc">${item.description}</p>
            </div>
            <span class="activity-time">${formatTimeAgo(item.time)}</span>
        </div>
    `,
    )
    .join("");
  overlay.querySelector("#modal-desc").innerHTML = list;
  overlay.querySelector("#modal-time").textContent = `全${sorted.length}件`;
  overlay.classList.add("open");

  // ページ番号を表示
  document.getElementById("page-info").textContent =
    `${currentPage} / ${Math.max(1, totalPages)}`;
}

document.getElementById("prev-page").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    openAllModal();
  }
});

document.getElementById("next-page").addEventListener("click", () => {
  const totalPages = Math.ceil(activities.length / pageSize);

  if (currentPage < totalPages) {
    currentPage++;
    openAllModal();
  }
});
// ─────────────────────────────────────────────
// 「すべて既読」ボタン（HTML側に id="btn-mark-all" があれば動く）
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderActivities();
  fetchSummary().then(renderSummary);

  // モーダルの閉じる処理（HTML側に書いたので、ここでイベントを登録）
  const overlay = document.getElementById("activity-modal-overlay");
  overlay.querySelector(".modal-close").addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
  document.getElementById("btn-show-all").addEventListener("click", () => {
    openAllModal();
  });

  const btnMarkAll = document.getElementById("btn-mark-all");
  if (btnMarkAll) {
    btnMarkAll.addEventListener("click", async () => {
      await markAllAsRead();
    });
  }
});
