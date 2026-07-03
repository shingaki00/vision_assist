const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();

const testData = JSON.parse(fs.readFileSync(path.join(__dirname, "testData.json"), "utf-8"));
const USE_TEST_DATA = true; // 本番に切り替えるときは false にする

// testData.json を読み込む
function loadTestData() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "testData.json"), "utf-8"));
}
let testData = loadTestData();

app.use(express.static(path.join(__dirname, "..")));
app.use(cors());
app.use(express.json());

// ────────────────────────────────────────────────
//   Firebase(Firestore) 初期化 
// db を null のままにし、testData.json を使う
// ────────────────────────────────────────────────
let db = null;
 
try {
    const serviceAccount = require("./serviceAccountKey.json");
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    db = admin.firestore();
    console.log("Firebase(Firestore)接続成功");
} catch (e) {
    console.warn(
        "Firebaseに接続できませんでした。テストデータを使用します。\n理由:",
        e.message
    );
}

// Firestoreからコレクションを取得し、失敗したらフォールバックデータを返す共通関数
async function fetchCollection(collectionName, fallbackData) {
    if (!db) return fallbackData;
    
    try {
        const snapshot = await db.collection(collectionName).get();
        if (snapshot.empty) return fallbackData;
        return snapshot.docs.map(doc => ({ ...doc.data() }));
    } catch (e) {
        console.error(
        `Firestore(${collectionName})の読み込みに失敗しました。testData.json を使用します。`,
        e.message
        );
        return fallbackData;
    }
}

// ユーザ一覧表示
app.get("/users", async (req, res) => {
  const patients = await fetchCollection("patients", testData.patients);
  res.json(patients);
});
 
// ユーザ登録
app.post("/addUser", async (req, res) => {
  try {
    const { login_id, name, age, emergency_note, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
 
    if (db) {
      await db.collection("patients").doc(id).set({
        id,
        login_id,
        password_hash: passwordHash,
        name,
        age,
        emergency_note,
      });
    } else {
      console.warn("Firebase未接続のため、登録内容は保存されていません（testData.jsonは読み取り専用）");
    }
    res.send("登録成功");

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});
 
// ユーザ検索
app.get("/patients/search", async (req, res) => {
  const keyword = (req.query.keyword || "").toLowerCase();
  const patients = await fetchCollection("patients", testData.patients);
 
  const results = patients.filter(
    p =>
      p.name.toLowerCase().includes(keyword) ||
      p.login_id.toLowerCase().includes(keyword)
  );
  res.json(results);
});
 
// ログイン処理
app.post("/login", async (req, res) => {
  const { login_id, password } = req.body;

  if (!login_id || !password) {
    return res.status(400).json({ message: "IDとパスワードを入力してください" });
  }
  if (!isValidEmail(login_id)) {
    return res.status(400).json({ message: "ログインIDはメールアドレス形式で入力してください" });
  }
 
   // ── testData.json（開発用フォールバック・平文比較） ──
   // ⚠️ 一時的に有効化中。Firebase接続後は再度コメントアウトすること
    if (!db) {
        const foundAdmin = testData.admins.find(
        a => a.login_id === login_id && a.password === password
        );
        if (foundAdmin) {
        return res.json({ success: true, uid: String(foundAdmin.id), name: foundAdmin.name });
        }
        return res.status(401).json({ message: "ログインIDまたはパスワードが違います" });
    }
 
    try {
        const snapshot = await db
        .collection("admins")
        .where("login_id", "==", login_id)
        .limit(1)
        .get();
    
        if (snapshot.empty) {
        return res.status(401).json({ message: "ログインIDまたはパスワードが違います" });
        }
    
        // ── 本番仕様：ハッシュ比較 ──
        // Firestore側の admins ドキュメントは password_hash（bcrypt.hash 済みの文字列）
        const isMatch = await bcrypt.compare(password, adminData.password_hash);
        if (isMatch) {
            // uid は将来 Firebase Authentication に切り替えた際の user.uid と同じ役割
            // （今はFirestoreのドキュメントIDを代用）
            return res.json({ success: true, uid: adminDoc.id, name: adminData.name });
        }
        return res.status(401).json({ message: "ログインIDまたはパスワードが違います" });
    } catch (e) {
        console.error("Firestoreへのログイン照会に失敗しました。", e.message);
 
        // ── testData.json（開発用フォールバック・平文比較） ──
        // 本番では使わないためコメントアウト
        /*
        const foundAdmin = testData.admins.find(
        a => a.login_id === login_id && a.password === password
        );
        if (foundAdmin) {
            return res.json({ success: true, uid: String(foundAdmin.id), name: foundAdmin.name });
        }
        */
        return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
 
// 歩行ログ
app.get("/walkingLogs", async (req, res) => {
    testData = loadTestData();
    const walkingLogs = await fetchCollection("walkingLogs", testData.walkingLogs);
    res.json(walkingLogs);
});
 
// アクティビティ
app.get("/activities", async (req, res) => {
    const activities = await fetchCollection("activities", testData.activities);
    res.json(activities);
});
 
// デバイス
app.get("/devices", async (req, res) => {
    const devices = await fetchCollection("devices", testData.devices);
    res.json(devices);
});
 
// GPSデータ
app.get("/gpsData", async (req, res) => {
    const gpsData = await fetchCollection("gpsData", testData.gpsData);
    res.json(gpsData);
});
 
app.listen(3000, () => {
    console.log("サーバー起動");
});
