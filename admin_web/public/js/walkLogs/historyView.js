import { calcLongestStay, ROUTE_STYLE, MARKER_ICONS, toLatLngs, fitMapToPoints, createMarker } from "./script.js";

// ───── 履歴表示（完了済みログを一括描画） ───────────

const latLngs = toLatLngs(gpsPoints);
polyline = new google.maps.Polyline({ path: latLngs, ...ROUTE_STYLE, map });
fitMapToPoints(map, latLngs);

// Marker部分
const startMarker = createMarker(map, latLngs[0], MARKER_ICONS.start, "出発地点", "<b>出発地点</b>");
markers.push(startMarker);

const endMarker = createMarker(map, latLngs[latLngs.length - 1], MARKER_ICONS.end, "到着地点", "<b>到着地点</b>");
markers.push(endMarker);

const stayMarker = createMarker(
  map, stayLatLng, MARKER_ICONS.stay, `最長滞在：${stay.stayMinutes}分`,
  `<div style="font-size:13px;line-height:1.6;">
     <b>最長滞在地点</b><br>
     ${stay.stayMinutes}分間滞在<br>
     <span style="color:#888;font-size:11px;">${stay.latitude.toFixed(5)}, ${stay.longitude.toFixed(5)}</span>
   </div>`
);
markers.push(stayMarker);


// googleMap インスタンス
export function renderHistory(map, gpsPoints) {
  clearHistory();

  if (!gpsPoints || gpsPoints.length === 0) return;

  const latLngs = gpsPoints.map(p =>
    new google.maps.LatLng(p.latitude, p.longitude)
  );

  // ── 表示範囲を自動フィット ──
  if (latLngs.length === 1) {
    map.setCenter(latLngs[0]);
    map.setZoom(17);
  } else {
    const bounds = new google.maps.LatLngBounds();
    latLngs.forEach(ll => bounds.extend(ll));
    map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
  }
}

// 描画済みの線・マーカーを地図から消す
export function clearHistory() {
  markers.forEach(m => m.setMap(null));
  markers = [];
  if (polyline) {
    polyline.setMap(null);
    polyline = null;
  }
}