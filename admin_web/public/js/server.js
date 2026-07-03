const express = require("express");
const mysql = require("mysql2");

const app = express();
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const cors = require("cors");

app.use(express.static(path.join(__dirname, "..")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const connection = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "mysql",
  database: "vission_assist",
});

connection.connect((err) => {
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
            mail_address,
            password_hash
        FROM Patients
    `;
  connection.query(sql, (err, results) => {
    if (err) {
      res.status(500).send(err);
      return;
    }
    res.json(results);
  });
});
//ユーザ登録
app.post("/addUser", async (req, res) => {
  console.log(req.body);

  try {
    const mail_address = req.body.mail_address;
    const name = req.body.name;
    const age = req.body.age;
    const emergency_note = req.body.emergency_note;
    const userData = req.body;
    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const id = crypto.randomUUID();

    const sql = `INSERT INTO Patients(id,mail_address,password_hash,name,age,emergency_note) VALUES (?,?, ?, ?, ?, ?)`;
    connection.query(
      sql,
      [id, mail_address, passwordHash, name, age, emergency_note],
      (err, results) => {
        if (err) {
          console.error("SQLエラー");
          console.error(err);

          res.status(500).send(err);
          return;
        }
        res.send("登録成功");
      },
    );
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
});
//ユーザ検索
app.get("/patients/search", (req, res) => {
  const keyword = req.query.keyword;
  const sql = `SELECT mail_address,name,age,emergency_note FROM Patients WHERE name LIKE ? OR login_id LIKE ?`;
  const searchWord = `%${keyword}%`;
  connection.query(sql, [searchWord, searchWord], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }
    res.json(results);
  });
});

app.post("/login", (req, res) => {
  const { mail_address, password } = req.body;
  const sql = "SELECT * FROM Patients WHERE mail_address = ?";

  connection.query(sql, [mail_address], async (err, results) => {
    try {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
        });
      }
      console.error(results);
      if (results.length === 0) {
        return res.status(401).json({
          success: false,
        });
      }
      const user = results[0];

      console.log(user);
      console.log(user.password_hash);

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({
          success: false,
          message: "メールアドレスまたはパスワードが違います",
        });
      }
      return res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          mail_address: user.mail_address,
        },
      });
    } catch (e) {
      console.error("bcryptエラー:", e);

      return res.status(500).json({
        success: false,
        message: e.message,
      });
    }
  });
});

//コンソールのエラー修正する

app.listen(3000, () => {
  console.log("サーバー起動");
});
