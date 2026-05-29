import { getToday } from "./style.js";

// ─── testData.json 読み込み ───────────────────────
let testData = null;
let currentPatient = null;
let selectedLogId = null;

// Google Mapsインスタンス
let googleMap = null;
let routePolyline = null;
let mapMarkers = [];

// Google Maps APIの読み込み完了判定
window.initGoogleMaps = function () {
    window._googleMapsReady = true;
};

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
        document.getElementById("patientName").textContent = "利用者が見つかりません";
        return;
    }

    document.getElementById("patientName").textContent =
        `${currentPatient.name} さんの歩行ログ`;

    updateUserStats(patientId);
    renderList(patientId);
}

// ────────────────────────────────────────────────
// ─── 左パネル：歩行ログ一覧を描画 ────────────────
// ────────────────────────────────────────────────
function renderList(patientId) {
  const logs = testData.walkingLogs
    .filter(log => log.patient_id === patientId)
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  const container = document.getElementById("logList");
  document.getElementById("listCount").textContent = `${logs.length}件のログ`;

  if (logs.length === 0) {
    container.innerHTML = `<div class="log-empty">ログがありません</div>`;
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
        </div>
    `;
  }).join("");

    container.querySelectorAll(".user-row").forEach(row => {
        row.addEventListener("click", () => {
            // アクティブ状態の切り替え
            container.querySelectorAll(".user-row").forEach(r => r.classList.remove("active"));
            row.classList.add("active");
            selectLog(parseInt(row.dataset.id));
        });
    });
}

// ────────────────────────────────────────────────
// ─── ログ選択時の処理 ────────────────────────────
// ────────────────────────────────────────────────
function selectLog(logId) {
  selectedLogId = logId;

  const log = testData.walkingLogs.find(l => l.id === logId);
  const gpsPoints = testData.gpsData
    .filter(g => g.log_id === logId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 詳細エリアを表示
  document.getElementById("emptyState").style.display = "none";
  document.getElementById("detailContent").style.display = "block";

  // 地図を更新
  waitForMapsAndUpdate(gpsPoints);
}

// ─── Google Maps APIの準備を待ってから地図を更新 ──
function waitForMapsAndUpdate(gpsPoints) {
    if (window._googleMapsReady || (window.google && window.google.maps)) {
        updateMap(gpsPoints);
    } else {
        // APIがまだ読み込まれていない場合は少し待つ
        const interval = setInterval(() => {
        if (window.google && window.google.maps) {
            clearInterval(interval);
            updateMap(gpsPoints);
        }
        }, 100);
    }
}


// ────────────────────────────────────────────────
// ─── 統計カードを更新 ────────────────────────────
// ────────────────────────────────────────────────
function updateUserStats(patientId) {
  const logs = testData.walkingLogs.filter(l => l.patient_id === patientId);

  // 登録日
  document.getElementById("statRegisteredAt").textContent =
    currentPatient.registered_at ?? "—";

  // 総ログ数
  document.getElementById("statLogCount").textContent = `${logs.length}件`;

  // 総歩行距離（全ログの GPS 軌跡を合計）
  let totalDistM = 0;
  logs.forEach(log => {
    const pts = testData.gpsData
      .filter(g => g.log_id === log.id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 1; i < pts.length; i++) {
      totalDistM += calcDistanceM(
        pts[i - 1].latitude, pts[i - 1].longitude,
        pts[i].latitude,     pts[i].longitude
      );
    }
  });
  document.getElementById("statTotalDistance").textContent =
    totalDistM >= 1000
      ? `${(totalDistM / 1000).toFixed(1)} km`
      : `${Math.round(totalDistM)} m`;

  // 平均歩行時間（ログ1件あたりの平均所要時間）
  if (logs.length === 0) {
    document.getElementById("statAvgDuration").textContent = "—";
    return;
  }
  const totalMs = logs.reduce((sum, log) => {
    const ms = new Date(log.end_time) - new Date(log.start_time);
    return sum + (ms > 0 ? ms : 0);
  }, 0);
  const avgMin = Math.round(totalMs / logs.length / 60000);
  document.getElementById("statAvgDuration").textContent = `${avgMin}分`;
}

// 最長滞在地点を計算（案A：誤差15m以内を同一地点と判定）
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

// ────────────────────────────────────────────────
//  Google Maps で地図・ルートを表示 
// ────────────────────────────────────────────────
function updateMap(gpsPoints) {
  if (gpsPoints.length === 0) return;

  const mapEl = document.getElementById("map");

  // 地図をまだ初期化していなければ生成
  if (!googleMap) {
    googleMap = new google.maps.Map(mapEl, {
      zoom: 15,
      mapTypeId: "roadmap",
      // シンプルなスタイル（任意で変更可）
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
  }

  // 既存のマーカー・ポリラインをクリア
  mapMarkers.forEach(m => m.setMap(null));
  mapMarkers = [];
  if (routePolyline) routePolyline.setMap(null);

  // GPS点を LatLng に変換
  const latLngs = gpsPoints.map(p =>
    new google.maps.LatLng(p.latitude, p.longitude)
  );

  // ── ルートラインを描画 ──
  routePolyline = new google.maps.Polyline({
    path: latLngs,
    geodesic: true,
    strokeColor: "#1a73e8",
    strokeOpacity: 0.85,
    strokeWeight: 4,
    map: googleMap,
  });

  // ── 地図の表示範囲を自動フィット ──
  const bounds = new google.maps.LatLngBounds();
  latLngs.forEach(ll => bounds.extend(ll));
  googleMap.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });

  // ── 開始マーカー（緑） ──
  const startMarker = new google.maps.Marker({
    position: latLngs[0],
    map: googleMap,
    title: "出発地点",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: "#34a853",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    },
  });
  mapMarkers.push(startMarker);

  // ── 終了マーカー（赤） ──
  const endMarker = new google.maps.Marker({
    position: latLngs[latLngs.length - 1],
    map: googleMap,
    title: "到着地点",
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: "#ea4335",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    },
  });
  mapMarkers.push(endMarker);

  // ── 最長滞在マーカー（黄） ──
  const stay = calcLongestStay(gpsPoints);
  const stayLatLng = new google.maps.LatLng(stay.latitude, stay.longitude);

  const stayMarker = new google.maps.Marker({
    position: stayLatLng,
    map: googleMap,
    title: `最長滞在：${stay.stayMinutes}分`,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 11,
      fillColor: "#fbbc04",
      fillOpacity: 1,
      strokeColor: "#fff",
      strokeWeight: 2,
    },
  });
  mapMarkers.push(stayMarker);

  // ── 吹き出し（InfoWindow） ──
  const infoWindow = new google.maps.InfoWindow({
    content: `<div style="font-size:13px;line-height:1.6;">
      <b>最長滞在地点</b><br>
      ${stay.stayMinutes}分間滞在<br>
      <span style="color:#888;font-size:11px;">
        ${stay.latitude.toFixed(5)}, ${stay.longitude.toFixed(5)}
      </span>
    </div>`,
  });

  stayMarker.addListener("click", () => {
    infoWindow.open(googleMap, stayMarker);
  });

  // 開始・終了にもシンプルなInfoWindow
  [
    { marker: startMarker, label: "出発地点" },
    { marker: endMarker,   label: "到着地点" },
  ].forEach(({ marker, label }) => {
    marker.addListener("click", () => {
      new google.maps.InfoWindow({ content: `<b>${label}</b>` }).open(googleMap, marker);
    });
  });
}

// ─── ユーティリティ：歩行時間を計算 ──────────────
function calcDuration(start, end) {
  const ms  = new Date(end) - new Date(start);
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} 分`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} 時間 ${m} 分`;
}

// ─── ユーティリティ：2点間の距離（メートル・Haversine） ──
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

// グローバルに公開
window.selectLog = selectLog;