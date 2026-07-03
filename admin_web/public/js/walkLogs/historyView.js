import { calcLongestStay, ROUTE_STYLE, markerColors, toLatLngs, fitMapToPoints, createMarker } from "./script.js";

// ───── 履歴表示（完了済みログを一括描画） ───────────

let markers = [];
let polyline = null;

// googleMap インスタンス
export function renderHistory(map, gpsPoints) {
    clearHistory();

    if (!gpsPoints || gpsPoints.length === 0) return;

    const latLngs = toLatLngs(gpsPoints);

    polyline = new google.maps.Polyline({
        path: latLngs,
        ...ROUTE_STYLE,
        map,
    });

    fitMapToPoints(map, latLngs);

    const startMarker = createMarker(
        map,
        latLngs[0],
        markerColors().start,
        "出発地点",
        "<b>出発地点</b>"
    );
    markers.push(startMarker);

    const endMarker = createMarker(
        map,
        latLngs[latLngs.length - 1],
        markerColors().end,
        "到着地点",
        "<b>到着地点</b>"
    );
    markers.push(endMarker);

    // 最長滞在地点
    const stay = calcLongestStay(gpsPoints);

    if (stay) {
        const stayLatLng = new google.maps.LatLng(
            stay.latitude,
            stay.longitude
        );

        const stayMarker = createMarker(
            map,
            stayLatLng,
            markerColors().stay,
            `最長滞在：${stay.stayMinutes}分`,
            `<div>
                <b>最長滞在地点</b><br>
                ${stay.stayMinutes}分間滞在
            </div>`
        );

        markers.push(stayMarker);
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