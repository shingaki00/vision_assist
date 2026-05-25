import { getToday } from "./style.js";

// ─── 状態管理 ────────────────────────────────────
let testData = null;
let users = [];
let currentFilter = "all";
let searchQuery = "";

// ─── 初期化 ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadTestData();
  buildUsers();
  renderList();
  setupEvents();
});

// ─── testData.json 読み込み ───────────────────────
async function loadTestData() {
  // testData.jsonはプロジェクトルート(admin_web直下)に置く想定
  const res = await fetch("../../testData.json");
  testData = await res.json();
}


// ─── testDataからusers配列を組み立て ────────────────
// walkLog.jsのrenderList()が期待するusersの形に変換する
function buildUsers() {
  const today = getToday(); // 今日の日付を取得

  users = testData.patients.map(patient => {

    // この患者の歩行ログを全件取得
    const logs = testData.walkingLogs.filter(
      log => log.patient_id === patient.id
    );

    // 今日のログ件数
    const todayLogs = logs.filter(
      log => log.start_time.startsWith(today)
    ).length;

    // 最終使用日（ログがあれば最新のstart_time、なければ「なし」）
    const lastLog = logs.sort(
      (a, b) => new Date(b.start_time) - new Date(a.start_time)
    )[0];
    const lastUsed = lastLog
      ? lastLog.start_time.slice(0, 10)
      : "なし";

    // デバイス情報（patient_idで紐付け）
    const device = testData.devices.find(
      d => d.patient_id === patient.id
    );
    const deviceLabel = device ? device.battery_status : "未登録";

    // アクティブ判定（直近7日以内にログがあればactive）
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const isActive = logs.some(
      log => new Date(log.start_time) >= sevenDaysAgo
    );

    return {
      id:        patient.id,
      name:      patient.name,
      initial:   patient.name.charAt(0),
      device:    deviceLabel,
      lastUsed:  lastUsed,
      totalLogs: logs.length,
      todayLogs: todayLogs,
      status:    isActive ? "active" : "inactive",
    };
  });
}


// ─── イベント設定 ─────────────────────────────────
// ――――――――――――――――――――――――――――――――――――――

// ─── リスト描画 ──────────────────────────────────
function renderList() {
  const q = searchQuery.toLowerCase();
  const filtered = users.filter(u => {
    const matchFilter =
      currentFilter === "all" ||
      (currentFilter === "active"   && u.status === "active") ||
      (currentFilter === "inactive" && u.status === "inactive");
    const matchSearch =
      !q || u.name.includes(q) || u.device.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const container = document.getElementById("userList");
  document.getElementById("listCount").textContent =
    `${filtered.length}件のユーザー`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty">該当するユーザーが見つかりません</div>`;
    return;
  }

  container.innerHTML = filtered.map((u, i) => `
    <div class="user-row"
         style="animation-delay:${i * 0.04}s"
         onclick="showLogs(${u.id})">

      <div class="avatar ${u.status === 'inactive' ? 'inactive' : ''}">
        ${u.initial}
      </div>

      <div class="user-info">
        <div class="user-name-row">
          <span class="user-name">${u.name}</span>
          <span class="badge ${u.status}">
            ${u.status === 'active' ? 'アクティブ' : '非アクティブ'}
          </span>
        </div>
        <div class="user-meta">
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2"/>
            </svg>
            ${u.device}
          </span>
          <span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${u.lastUsed}
          </span>
        </div>
      </div>

      <div class="user-stats">
        <div class="total-log">
          ${u.totalLogs}件
          <span style="font-size:10px;color:var(--text-muted)">総ログ数</span>
        </div>
        <div class="today-log ${u.todayLogs === 0 ? 'zero' : ''}">
          ${u.todayLogs}件
          <span style="font-size:10px;font-weight:400;color:var(--text-muted)">本日</span>
        </div>
      </div>
    
      <!-- ここで＞を入れる -->
    
    </div>
  `).join("");
}

// ─── 歩行ログ詳細表示（クリック時） ──────────────────
// ※今はalertで確認。あとでwalkLogs-user.htmlへ遷移に変更する
function showLogs(patientId) {
  const patient = testData.patients.find(p => p.id === patientId);
  const logs = testData.walkingLogs.filter(
    log => log.patient_id === patientId
  );

  if (logs.length === 0) {
    alert(`${patient.name} の歩行ログはまだありません`);
    return;
  }

  // TODO: walkLogs-user.htmlへパラメータ付きで遷移
  // window.location.href = `walkLogs-user.html?patient_id=${patientId}`;

  // 今はログ一覧をalertで確認
  const logList = logs.map(
    log => `・${log.start_time.slice(0, 16)} 〜 ${log.end_time.slice(11, 16)}`
  ).join("\n");
  alert(`【${patient.name} の歩行ログ】\n${logList}`);
}