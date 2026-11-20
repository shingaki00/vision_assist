document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".user-row");
  const contents = document.querySelectorAll(".tab-content");
  const btn = document.querySelector("#modeSwitch"); // チェックボックスの取得

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");

      const target = document.getElementById(tab.dataset.tab);
      if (target) {
        target.classList.add("active");
      }
    });
  });

  // 保存されたテーマを確認
  if (localStorage.getItem("dark") === "on") {
    document.body.classList.add("dark-mode");
    if (btn) {
      btn.checked = true;
    }
  }

  if (btn) {
    // チェックした時の挙動
    btn.addEventListener("change", async () => {
      let description = "";
      if (btn.checked == true) {
        // ダークモード
        document.body.classList.add("dark-mode");
        localStorage.setItem("dark", "on");
        description = "ダークモードが有効になりました";
      } else {
        // ライトモード
        document.body.classList.remove("dark-mode");
        localStorage.removeItem("dark");
        description = "ライトモードが有効になりました";
      }

      try {
        const response = await fetch("http://localhost:3000/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "システム設定変更",
            description: description,
          }),
        });

        if (!response.ok) {
          throw new Error("通知作成に失敗しました");
        }

        console.log("通知を作成しました");
      } catch (error) {
        console.error("通知APIエラー:", error);
      }
    });
  }
});
