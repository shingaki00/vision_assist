// ────────────────────────────────────────────────
// 見守り機能の動作確認用シミュレーター
//
// 使い方:
//   node simulateWalk.js [patientId] [intervalSeconds] [steps]
//
// 例:
//   node simulateWalk.js 1 5 15
//   → patient_id=1 のユーザーが、5秒おきに15回GPS点を送ってくる想定で歩行をシミュレート
//
// 注意:
//   - server.js と同じフォルダ（testData.jsonがある場所）で実行してください
//   - server.js を起動した状態のまま、別のターミナルで実行します
//   - server.js の /walkingLogs, /gpsData は毎回ファイルを読み直す作りなので、
//     このスクリプトがtestData.jsonを書き換えるとすぐ画面に反映されます
// ────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "testData.json");

const patientId = parseInt(process.argv[2]) || 1;
const intervalSeconds = parseInt(process.argv[3]) || 5;
const totalSteps = parseInt(process.argv[4]) || 15;

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 4), "utf-8");
}

function nextId(items) {
  return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
}

// 東京駅付近を基準に、ランダムウォークで少しずつ座標をずらしていく
let lat = 35.6812;
let lng = 139.7671;

function stepPosition() {
  // 1歩あたり約15〜25m相当（緯度経度の変化量として簡易近似）
  lat += (Math.random() - 0.3) * 0.0004;
  lng += (Math.random() - 0.3) * 0.0004;
  return { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
}

async function main() {
  const data = loadData();

  // ── 1. 進行中の歩行ログを新規作成（end_timeなし） ──
  const logId = nextId(data.walkingLogs);
  const startTime = new Date();

  data.walkingLogs.push({
    id: logId,
    patient_id: patientId,
    start_time: startTime.toISOString(),
    end_time: null,
    log_id: logId,
  });

  saveData(data);
  console.log(`[開始] patient_id=${patientId} の見守りを開始します（log_id=${logId}）`);
  console.log(`管理画面をリロードして、この利用者の一覧から「進行中」のログを選んでください。`);

  // ── 2. 一定間隔でGPS点を追加していく ──
  for (let i = 0; i < totalSteps; i++) {
    await sleep(intervalSeconds * 1000);

    const fresh = loadData(); // 他プロセスからの変更を拾わないよう都度読み直す
    const { latitude, longitude } = stepPosition();
    const pointId = nextId(fresh.gpsData);

    fresh.gpsData.push({
      id: pointId,
      log_id: logId,
      latitude,
      longitude,
      timestamp: new Date().toISOString(),
    });

    saveData(fresh);
    console.log(
      `[${i + 1}/${totalSteps}] GPS点を追加: (${latitude}, ${longitude})`
    );
  }

  // ── 3. 歩行終了（end_timeを付与）──
  const finalData = loadData();
  const log = finalData.walkingLogs.find(l => l.id === logId);
  if (log) {
    log.end_time = new Date().toISOString();
    saveData(finalData);
    console.log(`[終了] log_id=${logId} の歩行を終了しました。画面を履歴表示に切り替えます。`);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error("シミュレーター実行中にエラーが発生しました", err);
});