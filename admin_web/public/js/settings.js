const tabs = document.querySelectorAll(".tab");

const contents = document.querySelectorAll(".tab-content");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));

    contents.forEach((c) => c.classList.remove("active"));

    tab.classList.add("active");

    const target = document.getElementById(tab.dataset.tab);

    target.classList.add("active");
  });
});

document.addEventListener("DOMContentLoaded", () => {
  //const darkModeSwitch = document.getElementById("#modeSwitch");

  // チェックボックスの取得
  const btn = document.querySelector("#modeSwitch");

  // 保存されたテーマを確認
  if (localStorage.getItem("dark") === "on") {
    document.body.classList.add("dark-mode");

    if (btn) {
      btn.checked = true;
    }
  }

  if (btn) {
    // チェックした時の挙動
    btn.addEventListener("change", () => {
      if (btn.checked == true) {
        // ダークモード
        document.body.classList.add("dark-mode");
        localStorage.setItem("dark", "on");
      } else {
        // ライトモード
        document.body.classList.remove("dark-mode");
        localStorage.removeItem("dark");
      }
    });
  }
});
