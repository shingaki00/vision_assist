//　歩行ログファイルの共通の関数やスタイルをまとめる場所です

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

export const MARKER_ICONS = {
  start: markerIcon("#34a853"),        // 緑：出発地点
  end: markerIcon("#ea4335"),          // 赤：到着地点
  stay: markerIcon("#fbbc04", 11),     // 黄：最長滞在
  current: markerIcon("#4285f4"),      // 青：現在地（見守り中）
};

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
