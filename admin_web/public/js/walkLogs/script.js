import { getToday } from "../style.js";
import { renderHistory, clearHistory } from "./historyView.js";
import { startLiveTracking, stopLiveTracking } from "./liveTracking.js";

const API_BASE = "http://localhost:3000"; // server.js のURL

// ─── データ ────────────────────────────────────
let testData = null;
let currentPatient = null;
let selectedLogId = null;
 
// Google Mapsインスタンス（履歴表示・見守りの両方で共有）
let googleMap = null;
 
const mapsScript = document.createElement("script");
mapsScript.src = `https://maps.googleapis.com/maps/api/js?key=${__MAPS_KEY__}&callback=initGoogleMaps&loading=async`;
mapsScript.async = true;
mapsScript.defer = true;
document.head.appendChild(mapsScript);
 
// Google Maps APIの読み込み完了判定
window.initGoogleMaps = function () {
    window._googleMapsReady = true;
};
 
document.addEventListener("DOMContentLoaded", async () => {
    await loadTestData();
    initPage();
});
 
async function loadTestData() {
    try {
        const [patients, walkingLogs, gpsData] = await Promise.all([
            fetch(`${API_BASE}/users`).then(r => r.json()),
            fetch(`${API_BASE}/walkingLogs`).then(r => r.json()),
            fetch(`${API_BASE}/gpsData`).then(r => r.json()),
        ]);
        testData = { patients, walkingLogs, gpsData };
    } catch (e) {
        console.error("データの読み込みに失敗しました", e);
        document.getElementById("logList").innerHTML =
            `<div class="log-empty">データを読み込めませんでした</div>`;
    }
}
 
// ─── URLパラメータからpatient_idを取得して初期化 ──────
function initPage() {
    const params = new URLSearchParams(window.location.search);
    const patientId = parseInt(params.get("patient_id"));
 
    currentPatient = testData.patients.find(p => p.id === patientId);
    if (!currentPatient) {
        document.getElementById("patientName").textContent = "利用者が見つかりません";
        return;
    }
 
    document.getElementById("patientName").textContent =
        `${currentPatient.name} さんの歩行ログ`;
 
    updateUserStats(patientId);
    renderList(patientId);
}
 
// ─────────────────────────────────────
//   左パネル：歩行ログ一覧を描画
// ─────────────────────────────────────
function renderList(patientId) {
    const container = document.getElementById("logList");
    const logs = testData.walkingLogs
        .filter(log => log.patient_id === patientId)
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
 
    if (logs.length === 0) {
        container.innerHTML = `<div class="log-empty">ログがありません</div>`;
        return;
    }
 
    container.innerHTML = logs.map((log, i) => {
        const isLive = !log.end_time;
        const duration = isLive ? "進行中" : calcDuration(log.start_time, log.end_time);
        const date = log.start_time.slice(0, 10);
        const startT = log.start_time.slice(11, 16);
        const endT = isLive ? "―" : log.end_time.slice(11, 16);
        const pts = testData.gpsData
            .filter(g => g.log_id === log.id)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );
 
        const distStr = pts.length >= 2 ? formatDistance(calcTotalDistance(pts)) : " —";
 
        return `
            <div class="user-row"
                style="animation-delay:${i * 0.04}s"
                data-id="${log.id}">
                <div class="log-row-top">
                    <span class="log-date">${date}</span>
                    <span class="log-time">${startT} 〜 ${endT}</span>
                    <span class="log-duration">${isLive ? `🟢 ${duration}` : duration}</span>
                </div>
                <div class="log-meta">
                    <span>📍 ${distStr}</span>
                </div>
            </div>
        `;
    }).join("");
 
    container.querySelectorAll(".user-row").forEach(row => {
        row.addEventListener("click", () => {
            container.querySelectorAll(".user-row").forEach(r => r.classList.remove("active"));
            row.classList.add("active");
            selectLog(parseInt(row.dataset.id));
        });
    });
}
 
// ─────────────────────────────────────
//   ログ選択時の処理 
// ─────────────────────────────────────
function selectLog(logId) {
    // 前の描画（履歴・見守り）を必ずクリアしてから切り替える
    clearHistory();
    stopLiveTracking();
 
    selectedLogId = logId;
 
    const log = testData.walkingLogs.find(l => l.id === logId);
    const gpsPoints = testData.gpsData
        .filter(g => String(g.log_id) === String(logId))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
 
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("detailContent").style.display = "block";
 
    const isLive = !log.end_time;
 
    waitForMapsAndUpdate(() => {
        if (isLive) {
            startLiveTracking(googleMap, logId, gpsPoints, {
                onNewPoints: () => {
                    if (currentPatient) updateUserStats(currentPatient.id);
                },
                onFinished: (updatedLog) => {
                    const idx = testData.walkingLogs.findIndex(l => l.id === logId);
                    if (idx !== -1) testData.walkingLogs[idx] = updatedLog;
                    if (currentPatient) {
                        updateUserStats(currentPatient.id);
                        renderList(currentPatient.id);
                    }
                    // ログが完了したので、そのまま履歴表示に切り替える
                    const finishedPoints = testData.gpsData
                        .filter(g => String(g.log_id) === String(logId))
                        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                    renderHistory(googleMap, finishedPoints);
                },
            });
        } else {
            renderHistory(googleMap, gpsPoints);
        }
    });
}
 
// ─── Google Maps APIの準備を待ち、地図インスタンスを用意する ──
function waitForMapsAndUpdate(onReady) {
    const run = () => {
        ensureMap();
        onReady();
    };
 
    if (window._googleMapsReady || (window.google && window.google.maps)) {
        run();
        return;
    }
 
    let elapsed = 0;
    const interval = setInterval(() => {
        elapsed += 100;
 
        if (window.google && window.google.maps) {
            clearInterval(interval);
            run();
        } else if (elapsed > 10000) {
            clearInterval(interval);
            console.error("Google Maps APIの読み込みがタイムアウトしました");
            document.getElementById("map").innerHTML =
                `<div>地図を読み込めませんでした</div>`;
        }
    }, 100);
}
 
// 地図インスタンスをまだ作っていなければ作る（履歴・見守りで共有）
function ensureMap() {
    if (googleMap) return googleMap;
 
    googleMap = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        mapTypeId: "roadmap",
        styles: [
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
        ],
    });
    return googleMap;
}
 
// ─────────────────────────────────────
//   統計カードを更新 
// ─────────────────────────────────────
function updateUserStats(patientId) {
    const logs = testData.walkingLogs.filter(l => l.patient_id === patientId);
 
    document.getElementById("statLogCount").textContent = `${logs.length}件`;
 
    let totalDistM = 0;
    logs.forEach(log => {
    const pts = [...testData.gpsData.filter(g => g.log_id === log.id)]
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        totalDistM += calcTotalDistance(pts);}
    );
    document.getElementById("statTotalDistance").textContent = formatDistance(totalDistM);
 
    // 平均歩行時間（完了済みログのみで算出）
    const finishedLogs = logs.filter(l => l.end_time);
    if (finishedLogs.length === 0) {
        document.getElementById("statAvgDuration").textContent = "—";
        return;
    }
    const totalMs = finishedLogs.reduce((sum, log) => {
        const ms = new Date(log.end_time) - new Date(log.start_time);
        return sum + (ms > 0 ? ms : 0);
    }, 0);
    const avgMin = Math.round(totalMs / finishedLogs.length / 60000);
    document.getElementById("statAvgDuration").textContent = `${avgMin}分`;
}
// グローバルに公開
window.selectLog = selectLog;


//　───── 以下、歩行ログファイルの共通の関数やスタイルまとめ ─────

// ──────────────────────────
//  地図の共通スタイル設定
// ──────────────────────────
export const ROUTE_STYLE = {
  geodesic: true,
  strokeColor: "#1a73e8",
  strokeOpacity: 0.85,
  strokeWeight: 4,
};

function markerIcon(color, scale = 9) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#fff",
    strokeWeight: 2,
  };
}

export function markerColors() {
  return {
    start: markerIcon("#34a853"),        // 緑：出発地点
    end: markerIcon("#ea4335"),          // 赤：到着地点
    stay: markerIcon("#fbbc04", 11),     // 黄：最長滞在
    current: markerIcon("#4285f4"),      // 青：現在地（見守り中）
  };
}

// ──────────────────────────
//  共通ユーティリティ関数 
// ──────────────────────────

// 歩行時間を計算
function calcDuration(start, end) {
  const ms  = new Date(end) - new Date(start);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} 時間 ${m} 分`;
}

// 2点間の距離
function calcDistanceM(lat1, lng1, lat2, lng2) {
  const R    = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 最長滞在地点を計算（誤差15m以内を同一地点と判定）
export function calcLongestStay(gpsPoints) {
  const THRESHOLD_M = 15;
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

// GPS点配列を google.maps.LatLng 配列に変換
export function toLatLngs(gpsPoints) {
  return gpsPoints.map(p => new google.maps.LatLng(p.latitude, p.longitude));
}

// 地図の表示範囲をGPS点に合わせて自動調整
export function fitMapToPoints(map, latLngs) {
  if (latLngs.length === 0) return;
  if (latLngs.length === 1) {
    map.setCenter(latLngs[0]);
    map.setZoom(17);
    return;
  }
  const bounds = new google.maps.LatLngBounds();
  latLngs.forEach(ll => bounds.extend(ll));
  map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
}

// 距離をkm/m表記にフォーマット
export function formatDistance(meters) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

// ソート済みGPS点配列から合計距離を計算
export function calcTotalDistance(sortedPoints) {
  let total = 0;
  for (let i = 1; i < sortedPoints.length; i++) {
    total += calcDistanceM(
      sortedPoints[i - 1].latitude, sortedPoints[i - 1].longitude,
      sortedPoints[i].latitude, sortedPoints[i].longitude
    );
  }
  return total;
}

// マーカーを作成し、内容を渡せばクリックでInfoWindowも開けるようにする
export function createMarker(map, position, icon, title, infoContent = null) {
  const marker = new google.maps.Marker({ position, map, title, icon });
  if (infoContent) {
    const infoWindow = new google.maps.InfoWindow({ content: infoContent });
    marker.addListener("click", () => infoWindow.open(map, marker));
  }
  return marker;
}