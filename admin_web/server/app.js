// ログイン処理
app.post("/login", async (req, res) => {
    const bcrypt = require("bcrypt");
    const { username, password } = req.body;

    try{
        // DBからユーザー取得
        const user = await db.findUser(id);

        if (!user) {
            // ユーザーが存在しない場合も同じメッセージ
            res.json({ success: false });
        }

        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ success: true });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "サーバーエラー" });
    }
});