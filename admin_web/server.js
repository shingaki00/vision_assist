const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const cors = require("cors");
const admin = require("firebase-admin");
const { time } = require("console");
const console = require("console");

const app = express();

// testData.json を読み込む
function loadTestData() {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "testData.json"), "utf-8"),
  );
}
let testData = loadTestData();
const USE_TEST_DATA = true; // 本番に切り替えるときは false にする

function writeDebugLog(message, payload) {
  const timestamp = new Date().toISOString();
  const content = `[${timestamp}] ${message}${payload ? ` ${JSON.stringify(payload)}` : ""}\n`;
  fs.appendFileSync(path.join(__dirname, "auth-debug.log"), content, "utf8");
}

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
    e.message,
  );
}

// Firestoreからコレクションを取得し、失敗したらフォールバックデータを返す共通関数
async function fetchCollection(collectionName, fallbackData) {
  if (!db) return fallbackData;

  try {
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) return fallbackData;
    return snapshot.docs.map((doc) => ({ ...doc.data() }));
  } catch (e) {
    console.error(
      `Firestore(${collectionName})の読み込みに失敗しました。testData.json を使用します。`,
      e.message,
    );
    return fallbackData;
  }
}

// ユーザ登録
const usersFile = path.join(__dirname, "users.json");
function loadUsers() {
  if (!fs.existsSync(usersFile)) {
    return [];
  }
  const data = fs.readFileSync(usersFile, "utf-8");
  return JSON.parse(data || "[]");
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf-8");
}

app.post("/addUser", async (req, res) => {
  try {
    const { mail_address, name, age, emergency_note, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();

    if (db) {
      await db.collection("patients").doc(id).set({
        id,
        mail_address,
        password_hash: passwordHash,
        name,
        age,
        emergency_note,
      });
    } else {
      console.warn(
        "Firebase未接続のため、登録内容は保存されていません（testData.jsonは読み取り専用）",
      );
      const users = loadUsers();
      users.push({
        id,
        mail_address,
        password_hash: passwordHash,
        name,
        age,
        emergency_note,
      });

      saveUsers(users);
    }

    //ユーザー登録通知
    recordActivity("新規ユーザー登録", `${name}さんが登録されました`);
    res.send("登録成功");
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

// ユーザ一覧表示
app.get("/users", async (req, res) => {
  // const patients = await fetchCollection("patients", testData.patients);
  // res.json(patients);
  try {
    const users = loadUsers();

    // パスワードは一覧画面に返さない
    const displayUsers = users.map((user) => ({
      id: user.id,
      mail_address: user.mail_address,
      name: user.name,
      age: user.age,
      emergency_note: user.emergency_note,
    }));
    res.json(displayUsers);
  } catch (error) {
    console.error("ユーザー取得エラー:", error);
    res.status(500).json({
      message: "ユーザー情報を取得できませんでした",
    });
  }
});
//ユーザー削除
app.delete("/users", (req, res) => {
  try {
    const ids = req.body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        message: "削除対象を選択してください",
      });
    }
    // JSONファイルからユーザー情報を取得
    const users = loadUsers();
    // 選択されたユーザー以外を残す
    const remainingUsers = users.filter((user) => !ids.includes(user.id));

    const deletedCount = users.length - remainingUsers.length;

    if (deletedCount === 0) {
      return res.status(404).json({
        message: "削除対象が見つかりません",
      });
    }
    // JSONファイルに保存
    saveUsers(remainingUsers);

    try {
      recordActivity(
        "ユーザー削除",
        `${deletedCount}件のユーザが削除されました`,
      );
      console.log("削除通知を作成しました:", notification);
    } catch (error) {
      console.error("通知生成エラー:", error);
    }
    res.json({
      message: `${deletedCount}件削除しました`,
      deletedCount,
    });
  } catch (error) {
    console.error("ユーザー削除エラー:", error);

    res.status(500).json({
      message: "削除に失敗しました",
    });
  }
});

// ユーザ検索
app.get("/patients/search", async (req, res) => {
  const keyword = (req.query.keyword || "").toLowerCase();
  const patients = await fetchCollection("patients", testData.patients);
  // const users = await fetchCollection(usersFile.data);
  const results = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(keyword) ||
      p.mail_address.toLowerCase().includes(keyword),
  );
  res.json(results);
});

// 管理者ログイン
app.post("/admin/login", async (req, res) => {
  const rawBody = req.body || {};
  const mail_address = rawBody.mail_address ?? rawBody.login_id ?? "";
  const password_hash = rawBody.password_hash ?? rawBody.password ?? "";

  console.log("[admin/login] request body", JSON.stringify(rawBody));
  console.log("[admin/login] extracted credentials", {
    mail_address,
    password_provided: Boolean(password_hash),
    password_length: password_hash ? String(password_hash).length : 0,
  });
  writeDebugLog("[admin/login] request", {
    rawBody,
    mail_address,
    password_provided: Boolean(password_hash),
  });

  if (!mail_address || !password_hash) {
    console.warn("[admin/login] missing credentials in request");
    return res
      .status(400)
      .json({ message: "メールアドレスとパスワードを入力してください" });
  }
  if (!isValidEmail(mail_address)) {
    return res
      .status(400)
      .json({ message: "メールアドレスの形式が正しくありません" });
  }

  // ── testData.json（開発用フォールバック・平文比較） ──
  // ⚠️ 一時的に有効化中。Firebase接続後は再度コメントアウトすること
  if (!db) {
    const foundAdmin = testData.admins.find((a) => {
      const storedMail = a.mail_address ?? a.login_id ?? "";
      const storedPassword = a.password_hash ?? a.password ?? "";
      return storedMail === mail_address && storedPassword === password_hash;
    });
    console.log(
      "[admin/login] fallback match",
      foundAdmin ? "matched" : "no match",
    );
    if (foundAdmin) {
      //管理者ログイン通知
      recordActivity("ログイン", "管理者がログインしました");
      return res.json({
        success: true,
        uid: String(foundAdmin.id),
        name: foundAdmin.name,
      });
    }
    return res
      .status(401)
      .json({ message: "ログインIDまたはパスワードが違います" });
  }

  try {
    const snapshot = await db
      .collection("admins")
      .where("mail_address", "==", mail_address)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res
        .status(401)
        .json({ message: "メールアドレスまたはパスワードが違います" });
    }

    // ── 本番仕様：ハッシュ比較 ──
    // Firestore側の admins ドキュメントは password_hash（bcrypt.hash 済みの文字列）
    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();
    const isMatch = await bcrypt.compare(
      password_hash,
      adminData.password_hash,
    );
    if (isMatch) {
      // uid は将来 Firebase Authentication に切り替えた際の user.uid と同じ役割
      // （今はFirestoreのドキュメントIDを代用）
      //患者ログイン通知
      recordActivity("ログイン", `${adminData.name}がログインしました`);
      return res.json({
        success: true,
        uid: adminDoc.id,
        name: adminData.name,
      });
    }
    return res
      .status(401)
      .json({ message: "ログインIDまたはパスワードが違います" });
  } catch (e) {
    console.error("Firestoreへのログイン照会に失敗しました。", e.message);

    // ── testData.json（開発用フォールバック・平文比較） ──
    // 本番では使わないためコメントアウト
    /*
        const foundAdmin = testData.admins.find(
        a => a.mail_address === mail_address && a.password_hash === password_hash
        );
        if (foundAdmin) {
            return res.json({ success: true, uid: String(foundAdmin.id), name: foundAdmin.name });
        }
        */
    return res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

// 患者ログイン
app.post("/patient/login", async (req, res) => {
  const rawBody = req.body || {};
  const mail_address = rawBody.mail_address ?? rawBody.login_id ?? "";
  const password_hash = rawBody.password_hash ?? rawBody.password ?? "";

  console.log("[patient/login] request body", JSON.stringify(rawBody));
  console.log("[patient/login] extracted credentials", {
    mail_address,
    password_provided: Boolean(password_hash),
    password_length: password_hash ? String(password_hash).length : 0,
  });
  writeDebugLog("[patient/login] request", {
    rawBody,
    mail_address,
    password_provided: Boolean(password_hash),
  });

  if (!mail_address || !password_hash) {
    console.warn("[patient/login] missing credentials in request");
    return res
      .status(400)
      .json({ message: "メールアドレスとパスワードを入力してください" });
  }
  if (!isValidEmail(mail_address)) {
    return res
      .status(400)
      .json({ message: "メールアドレスの形式が正しくありません" });
  }

  // ── testData.json（開発用フォールバック・平文比較） ──
  // ⚠️ 一時的に有効化中。Firebase接続後は再度コメントアウトすること
  if (!db) {
    const foundPatient = testData.patients.find((p) => {
      const storedMail = p.mail_address ?? p.login_id ?? "";
      const storedPassword = p.password_hash ?? p.password ?? "";
      return storedMail === mail_address && storedPassword === password_hash;
    });
    if (foundPatient) {
      return res.json({
        success: true,
        patient_id: String(foundPatient.id),
      });
    }
    return res
      .status(401)
      .json({ message: "ログインIDまたはパスワードが違います" });
  }

  try {
    const snapshot = await db
      .collection("patients")
      .where("mail_address", "==", mail_address)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res
        .status(401)
        .json({ message: "メールアドレスまたはパスワードが違います" });
    }

    // ── 本番仕様：ハッシュ比較 ──
    // Firestore側の patients ドキュメントは password_hash（bcrypt.hash 済みの文字列）
    const patientDoc = snapshot.docs[0];
    const patientData = patientDoc.data();
    const isMatch = await bcrypt.compare(
      password_hash,
      patientData.password_hash,
    );
    if (isMatch) {
      // patient_id は将来 Firebase Authentication に切り替えた際の user.uid と同じ役割
      // （今はFirestoreのドキュメントIDを代用）
      return res.json({
        success: true,
        patient_id: patientDoc.id,
      });
    }
    return res
      .status(401)
      .json({ message: "ログインIDまたはパスワードが違います" });
  } catch (e) {
    console.error("Firestoreへのログイン照会に失敗しました。", e.message);

    // ── testData.json（開発用フォールバック・平文比較） ──
    // 本番では使わないためコメントアウト
    /*
        const foundPatient = testData.patients.find(
        p => p.mail_address === mail_address && p.password_hash === password_hash
        );
        if (foundPatient) {
            return res.json({ success: true, patient_id: String(foundPatient.id) });
        }
        */
    return res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 歩行ログ読み取り
app.get("/walkingLogs", async (req, res) => {
  if (USE_TEST_DATA) {
    testData = loadTestData();
  }
  const walkingLogs = await fetchCollection(
    "walkingLogs",
    testData.walkingLogs,
  );
  res.json(walkingLogs);
});

//歩行ログ作成
app.post("/walkingLogs", (req, res) => {
  const { patient_id, start_time, end_time } = req.body;

  // 同じ患者で end_time が null/未設定の過去ログがあれば自動で終了扱いにする
  testData.walkingLogs.forEach((log) => {
    if (String(log.patient_id) === String(patient_id) && !log.end_time) {
      // 直近のGPSデータのタイムスタンプを探す
      const lastGps = testData.gpsData
        ? testData.gpsData.filter((g) => g.log_id === log.id).pop()
        : null;

      // 最後のGPS時刻、無ければ新しいログの開始時刻(start_time)を入れる
      log.end_time = lastGps
        ? lastGps.timestamp
        : start_time || new Date().toISOString();
      console.log(
        `[Auto-Fix] 過去の未終了ログ (id: ${log.id}) の end_time を自動補完しました`,
      );
    }
  });

  const id =
    testData.walkingLogs.length > 0
      ? Math.max(...testData.walkingLogs.map((l) => l.id)) + 1
      : 1;

  const log = {
    id,
    patient_id,
    start_time,
    end_time: end_time || null,
  };

  testData.walkingLogs.push(log);
  res.status(201).json(log);
});

// 歩行ログ更新（end_timeのみ）
app.patch("/walkingLogs/:id", (req, res) => {
  const id = Number(req.params.id);
  const log = testData.walkingLogs.find((l) => l.id === id);

  if (!log) {
    return res.status(404).json({ message: "ログが見つかりません" });
  }

  log.end_time = req.body.end_time;
  res.json(log);
  recordActivity(
    "歩行ログ更新",
    `${patients.name}さんの歩行ログが更新されました`,
  );
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

// GPSデータ読み取り
app.get("/gpsData", async (req, res) => {
  const gpsData = await fetchCollection("gpsData", testData.gpsData);
  res.json(gpsData);
});

// GPSデータ追加
app.post("/gpsData", (req, res) => {
  console.log("GPS受信:", req.body);

  const id =
    testData.gpsData.length > 0
      ? Math.max(...testData.gpsData.map((g) => g.id)) + 1
      : 1;

  const gps = {
    id,
    ...req.body,
  };
  testData.gpsData.push(gps);

  fs.writeFileSync(
    path.join(__dirname, "testData.json"),
    JSON.stringify(testData, null, 2),
    "utf-8",
  );
  console.log("GPS保存後件数:", testData.gpsData.length);

  res.status(201).json(gps);
});

app.listen(3000, () => {
  console.log("サーバー起動");
});

const activitiesPath = path.join(__dirname, "notifications.json");

function loadActivities() {
  try {
    return JSON.parse(fs.readFileSync(activitiesPath, "utf-8"));
  } catch (error) {
    console.error("通知ファイルの読み込み失敗:", error);
    return [];
  }
}

function saveActivities(activities) {
  fs.writeFileSync(
    activitiesPath,
    JSON.stringify(activities, null, 2),
    "utf-8",
  );
}

function recordActivity(title, description) {
  const activities = loadActivities();

  const newActivity = {
    id: Date.now().toString(),
    title: title,
    description: description,
    time: new Date().toISOString(),
    read: false,
  };

  activities.unshift(newActivity);
  saveActivities(activities);

  return newActivity;
}

// 通知一覧を取得するAPI
app.get("/notifications", (req, res) => {
  try {
    const filePath = path.join(__dirname, "notifications.json");
    // JSONファイルを読み込む
    const jsonData = fs.readFileSync(filePath, "utf-8");

    // // JSON文字列をJavaScriptの配列に変換
    const activities = JSON.parse(jsonData);

    console.log("読み込んだファイル:", filePath);
    console.log("返却する通知:", activities);
    // 通知一覧を返す
    res.json(activities);
  } catch (error) {
    console.error("通知データの取得に失敗しました:", error);

    res.status(500).json({
      message: "通知データを取得できませんでした",
    });
  }
});
// 1件を既読にする
app.patch("/notifications/:id/read", (req, res) => {
  try {
    const activities = loadActivities();

    const target = activities.find(
      (item) => String(item.id) === String(req.params.id),
    );

    if (!target) {
      return res.status(404).json({
        message: "通知が見つかりません",
      });
    }

    target.read = true;
    saveActivities(activities);

    res.json({ message: "既読にしました" });
  } catch (error) {
    console.error("既読更新エラー:", error);
    res.status(500).json({
      message: "既読状態を更新できませんでした",
    });
  }
});

// 全件を既読にする
app.patch("/notifications/read-all", (req, res) => {
  try {
    const activities = loadActivities();

    activities.forEach((item) => {
      item.read = true;
    });

    saveActivities(activities);

    res.json({ message: "すべて既読にしました" });
  } catch (error) {
    console.error("全件既読更新エラー:", error);
    res.status(500).json({
      message: "既読状態を更新できませんでした",
    });
  }
});

app.post("/notifications", (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        message: "通知タイトルと内容を入力してください",
      });
    }

    // 既存の通知作成関数を呼び出す
    const notification = recordActivity(title, description);

    res.status(201).json({
      message: "通知を作成しました",
      notification,
    });
  } catch (error) {
    console.error("通知作成エラー:", error);

    res.status(500).json({
      message: "通知の作成に失敗しました",
    });
  }
});
