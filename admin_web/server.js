const express = require("express");
const mysql = require("mysql2");

const app = express();
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

app.use(express.static(path.join(__dirname, "..")));
app.use(express.json());

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "mysql",
  database: "vission_assist",
});

pool.getConnection((err, connection) => {
  if (err) {
    console.log("接続失敗");
    console.log(err);
    return;
  }
  console.log("MySQL接続成功");
});
//ユーザ一覧表示
app.get("/users", (req, res) => {
  const sql = `
        SELECT
            id,
            name,
            age,
            emergency_note,
            login_id
        FROM Patients
    `;
  pool.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "サーバーエラーが発生しました" });
      return;
    }
    res.json(results);
  });
});
//ユーザ登録
app.post("/addUser", async (req, res) => {
  try {
    const login_id = req.body.login_id;
    const name = req.body.name;
    const age = req.body.age;
    const emergency_note = req.body.emergency_note;
    const userData = req.body;
    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const id = crypto.randomUUID();

    const sql = `INSERT INTO Patients(id,login_id,password_hash,name,age,emergency_note) VALUES (?,?, ?, ?, ?, ?)`;
    pool.query(
      sql,
      [id, login_id, passwordHash, name, age, emergency_note],
      (err, results) => {
        if (err) {
          console.error(err);
          res.status(500).json({ message: "サーバーエラーが発生しました" });
          return;
        }
        res.send("登録成功");
      },
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "サーバーエラーが発生しました" });
  }
});
//ユーザ検索
app.get("/patients/search", (req, res) => {
  const keyword = req.query.keyword;
  const sql = `SELECT login_id,name,age,emergency_note FROM Patients WHERE name LIKE ? OR login_id LIKE ?`;
  const searchWord = `%${keyword}%`;
  pool.query(sql, [searchWord, searchWord], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "サーバーエラーが発生しました" });
      return;
    }
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log("サーバー起動");
});
