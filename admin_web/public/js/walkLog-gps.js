import { getToday } from "./style.js";

// ─── testData.json 読み込み ───────────────────────
let testData = null;
let currentPatient = null;
let selectedLogId = null;

document.addEventListener("DOMContentLoaded", async () => {
  await loadTestData();
  initPage();
});

async function loadTestData() {
  const res = await fetch("../../testData.json");
  testData = await res.json();
}

// ─── URLパラメータからpatient_idを取得して初期化 ──
function initPage() {
  const params = new URLSearchParams(window.location.search);
  const patientId = parseInt(params.get("patient_id"));

  currentPatient = testData.patients.find(p => p.id === patientId);
  if (!currentPatient) {
    document.getElementById("patientName").textContent = "患者が見つかりません";
    return;
  }

  document.getElementById("patientName").textContent =
    `${currentPatient.name} の歩行ログ`;

  renderList(patientId);
}

// ─── 左パネル：歩行ログ一覧を描画 ────────────────
function renderList(patientId) {
  const logs = testData.walkingLogs
    .filter(log => log.patient_id === patientId)
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  const container = document.getElementById("logList");
  document.getElementById("listCount").textContent = `${logs.length}件`;

  if (logs.length === 0) {
    container.innerHTML = `<div class="log-empty">歩行ログがありません</div>`;
    return;
  }

  container.innerHTML = logs.map((log, i) => {
    const duration = calcDuration(log.start_time, log.end_time);
    const date = log.start_time.slice(0, 10);
    const startT = log.start_time.slice(11, 16);
    const endT   = log.end_time.slice(11, 16);

    return `
        <div class="user-row"
             style="animation-delay:${i * 0.04}s"
             data-id="${log.id}">

            <div class="log-date">${date}</div>
            <div class="log-time">${startT} 〜 ${endT}</div>
            <div class="log-duration">${duration}</div>
            <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
            </svg>
        </div>
    `;
  }).join("");

    container.querySelectorAll(".user-row").forEach(row => {
    row.addEventListener("click", () => {selectLog(parseInt(row.dataset.id));});
});
}

// ─── ログ選択時の処理 ────────────────────────────
function selectLog(logId) {
  selectedLogId = logId;

  // アクティブ状態の切り替え
  document.querySelectorAll(".log-item").forEach(el => {
    el.classList.toggle("active", parseInt(el.dataset.logId) === logId);
  });

  const log = testData.walkingLogs.find(l => l.id === logId);
  const gpsPoints = testData.gpsData
    .filter(g => g.log_id === logId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 詳細エリアを表示
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("detailContent").style.display = "block";

  // 統計を更新
  updateStats(log, gpsPoints);

  // 地図を更新
  updateMap(gpsPoints);
}

// ─── 統計カードを更新 ─────────────────────────────
function updateStats(log, gpsPoints) {
  const startT  = log.start_time.slice(0, 16).replace("T", " ");
  const endT    = log.end_time.slice(11, 16);
  const duration = calcDuration(log.start_time, log.end_time);

  document.getElementById("statDatetime").textContent =
    `${startT} 〜 ${endT}`;
  document.getElementById("statDuration").textContent = duration;

  if (gpsPoints.length < 2) {
    document.getElementById("statDistance").textContent   = "データ不足";
    document.getElementById("statTimeToStay").textContent = "データ不足";
    document.getElementById("stayLocation").textContent   = "—";
    document.getElementById("stayDuration").textContent   = "";
    return;
  }

  // 最長滞在地点を計算
  const stayResult = calcLongestStay(gpsPoints);

  // 開始地点から最長滞在地点までの距離・所要時間
  const startPoint = gpsPoints[0];
  const distM = calcDistanceM(
    startPoint.latitude, startPoint.longitude,
    stayResult.latitude, stayResult.longitude
  );
  const distStr = distM >= 1000
    ? `${(distM / 1000).toFixed(2)} km`
    : `${Math.round(distM)} m`;

  const timeToStay = calcDuration(log.start_time, stayResult.arrivedAt);

  document.getElementById("statDistance").textContent   = distStr;
  document.getElementById("statTimeToStay").textContent = timeToStay;
  document.getElementById("stayLocation").textContent   =
    `${stayResult.latitude.toFixed(5)}, ${stayResult.longitude.toFixed(5)}`;
  document.getElementById("stayDuration").textContent   =
    `滞在 ${stayResult.stayMinutes} 分`;
}

// ─── 最長滞在地点を計算（案A：誤差15m以内を同一地点と判定） ──
function calcLongestStay(gpsPoints) {
  const THRESHOLD_M = 15; // 同一地点とみなす距離（メートル）
  let best = null;

  for (let i = 0; i < gpsPoints.length; i++) {
    let stayEnd = i;

    for (let j = i + 1; j < gpsPoints.length; j++) {
      const d = calcDistanceM(
        gpsPoints[i].latitude, gpsPoints[i].longitude,
        gpsPoints[j].latitude, gpsPoints[j].longitude
      );
      if (d <= THRESHOLD_M) {
        stayEnd = j;
      } else {
        break;
      }
    }

    const stayMs =
      new Date(gpsPoints[stayEnd].timestamp) -
      new Date(gpsPoints[i].timestamp);
    const stayMinutes = Math.round(stayMs / 60000);

    if (!best || stayMs > best.stayMs) {
      best = {
        latitude:  gpsPoints[i].latitude,
        longitude: gpsPoints[i].longitude,
        stayMs,
        stayMinutes,
        arrivedAt: gpsPoints[i].timestamp,
        pointIndex: i,
      };
    }
  }

  return best;
}

// ─── SVGダミー地図を更新 ──────────────────────────
function updateMap(gpsPoints) {
  if (gpsPoints.length === 0) return;

  // GPS座標をSVG座標（0〜600, 0〜340）にマッピング
  const lats = gpsPoints.map(p => p.latitude);
  const lngs = gpsPoints.map(p => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const PAD = 60;

  function toSVG(lat, lng) {
    const rangeL = maxLng - minLng || 0.0001;
    const rangeA = maxLat - minLat || 0.0001;
    const x = PAD + ((lng - minLng) / rangeL) * (600 - PAD * 2);
    const y = (340 - PAD) - ((lat - minLat) / rangeA) * (340 - PAD * 2);
    return { x, y };
  }

  // ルート描画
  const points = gpsPoints.map(p => {
    const { x, y } = toSVG(p.latitude, p.longitude);
    return `${x},${y}`;
  }).join(" ");
  document.getElementById("routeLine").setAttribute("points", points);

  // 開始マーカー
  const start = toSVG(gpsPoints[0].latitude, gpsPoints[0].longitude);
  const markerStart = document.getElementById("markerStart");
  markerStart.setAttribute("cx", start.x);
  markerStart.setAttribute("cy", start.y);

  // 終了マーカー
  const end = toSVG(
    gpsPoints[gpsPoints.length - 1].latitude,
    gpsPoints[gpsPoints.length - 1].longitude
  );
  const markerEnd = document.getElementById("markerEnd");
  markerEnd.setAttribute("cx", end.x);
  markerEnd.setAttribute("cy", end.y);

  // 最長滞在マーカー
  const stay = calcLongestStay(gpsPoints);
  const stayPos = toSVG(stay.latitude, stay.longitude);
  const markerStay = document.getElementById("markerStay");
  markerStay.setAttribute("cx", stayPos.x);
  markerStay.setAttribute("cy", stayPos.y);
}

// ─── ユーティリティ：歩行時間を計算 ──────────────
function calcDuration(start, end) {
  const ms = new Date(end) - new Date(start);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} 時間 ${m} 分`;
}

// ─── ユーティリティ：2点間の距離（メートル）────────
// Haversine公式
function calcDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// グローバルに公開（HTML onclickから呼ぶため）
window.selectLog = selectLog;