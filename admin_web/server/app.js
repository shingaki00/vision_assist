const path = require("path");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/login.html"));
});

app.get("/home", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ログイン処理
app.post("/login", async (req, res) => {
    const bcrypt = require("bcrypt");
    const id = req.body.id || req.body.userId || req.body.username;
    const password = req.body.password;

    if (!id || !password) {
        return res.status(400).json({ success: false, message: "IDとパスワードを入力してください" });
    }

    try {
        const user = typeof db !== "undefined" && db && typeof db.findUser === "function"
            ? await db.findUser(id)
            : null;

        if (!user) {
            return res.json({ success: false });
        }

        if (user && await bcrypt.compare(password, user.password)) {
            return res.json({ success: true });
        } else {
            return res.json({ success: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "サーバーエラー" });
    }
});

app.listen(PORT, () => {
    console.log(`Admin web server running at http://localhost:${PORT}`);
});