// ─── リアルタイム見守り機能 ──────────────────────
// このモジュールは「end_time がまだ無い = 進行中の歩行ログ」を
// 一定間隔でポーリングし、線を伸ばしながら描画する役割を持つ。

import { ROUTE_STYLE, markerColors, toLatLngs, fitMapToPoints, createMarker } from "./script.js";

const API_BASE = "http://localhost:3000";
const POLL_INTERVAL_MS = 5000; // ポーリング間隔（ミリ秒）※必要に応じて調整

let polyline = null;
let startMarker = null;
let currentPositionMarker = null;
let pollTimer = null;
let liveLogId = null;
let lastTimestamp = null;
let callbacks = {};


// ライブ監視を開始する
// initialPoints: 選択した時点で既に届いているGPS点（時系列順ソート済み）
// options.onNewPoints(newPoints): 新しい点が反映されたときに呼ばれる
// options.onFinished(updatedLog): ログが完了（end_timeが付与）した時に呼ばれる
export function startLiveTracking(map, logId, initialPoints, options = {}) {
  stopLiveTracking();

  liveLogId = logId;
  callbacks = options;
  lastTimestamp = initialPoints.length
    ? initialPoints[initialPoints.length - 1].timestamp
    : null;

  drawInitial(map, initialPoints);
  showBadge(true);

  pollTimer = setInterval(() => poll(map, logId), POLL_INTERVAL_MS);
}

// ライブ監視を停止し、描画も消す
export function stopLiveTracking() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  liveLogId = null;
  lastTimestamp = null;
  callbacks = {};
  clear();
}

// 現在ライブ監視中かどうか
export function isTracking() {
  return pollTimer !== null;
}

// ── 内部処理 ──────────────────────────────────

function drawInitial(map, initialPoints) {
  const latLngs = toLatLngs(initialPoints);

  polyline = new google.maps.Polyline({ path: latLngs, ...ROUTE_STYLE, map });

  if (latLngs.length === 0) return;

  fitMapToPoints(map, latLngs);

  startMarker = createMarker(map, latLngs[0], markerColors().start, "出発地点", "<b>出発地点</b>");
  currentPositionMarker = createMarker(map, latLngs[latLngs.length - 1], markerColors().current, "現在地");
}

// サーバーに新しいGPS点・ログ完了状態を問い合わせる
async function poll(map, logId) {
  try {
    // ── 新しいGPS点を取得 ──
    // server.js の /gpsData はクエリを無視して全件返すため、ここでは
    // 全件取得してからクライアント側で対象ログ分だけを絞り込む
    const gpsRes = await fetch(`${API_BASE}/gpsData`);
    const allPoints = await gpsRes.json();

    const sorted = allPoints
      .filter(g => String(g.log_id) === String(logId))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    const newPoints = lastTimestamp
      ? sorted.filter(p => new Date(p.timestamp) > new Date(lastTimestamp))
      : sorted;

    if (newPoints.length > 0) {
      newPoints.forEach(p => appendPoint(map, p));
      lastTimestamp = newPoints[newPoints.length - 1].timestamp;
      callbacks.onNewPoints?.(newPoints);
    }

    // ── ログが完了（end_timeが付与）されていないか確認 ──
    // server.js には /walkingLogs/:id が無いため、一覧取得から探す
    const logsRes = await fetch(`${API_BASE}/walkingLogs`);
    const logs = await logsRes.json();
    const updatedLog = logs.find(l => String(l.id) === String(logId));

    if (updatedLog && updatedLog.end_time) {
      stopLiveTracking();
      callbacks.onFinished?.(updatedLog);
    }
  } catch (e) {
    console.error("見守りデータの取得に失敗しました", e);
  }
}

function appendPoint(map, point) {
  const latLng = new google.maps.LatLng(point.latitude, point.longitude);

  if (!polyline) return;
  polyline.getPath().push(latLng);

  if (!currentPositionMarker) {
    currentPositionMarker = createMarker(map, latLng, markerColors().current, "現在地");
  } else {
    currentPositionMarker.setPosition(latLng);
  }
  map.panTo(latLng);
}

function showBadge(show) {
  let badge = document.getElementById("liveBadge");

  if (show) {
    if (!badge) {
      const mapEl = document.getElementById("map");
      mapEl.style.position = mapEl.style.position || "relative";

      badge = document.createElement("div");
      badge.id = "liveBadge";
      badge.textContent = "🟢 見守り中（リアルタイム更新）";
      badge.style.cssText = `
        position:absolute; top:8px; left:8px; z-index:5;
        background:#fff; color:#1a73e8; font-weight:bold; font-size:12px;
        padding:4px 10px; border-radius:12px;
        box-shadow:0 1px 4px rgba(0,0,0,.25);
      `;
      mapEl.appendChild(badge);
    }
  } else if (badge) {
    badge.remove();
  }
}

// 描画済みの線・マーカー・バッジを地図から消す
export function clear() {
  if (polyline) {
    polyline.setMap(null);
    polyline = null;
  }
  if (startMarker) {
    startMarker.setMap(null);
    startMarker = null;
  }
  if (currentPositionMarker) {
    currentPositionMarker.setMap(null);
    currentPositionMarker = null;
  }
  showBadge(false);
}