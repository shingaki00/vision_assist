const patientList = document.getElementById("patientList");
const modal = document.getElementById("modal");
const detailArea = document.getElementById("detailArea");
const closeBtn = document.getElementById("closeBtn");

let allPatients = []; // allPatientsにJSON全件を保持しておく

// JSON読み込み
fetch("http://localhost:3000/users")
  .then((response) => response.json())
  .then((data) => {
    allPatients = data;
    data.forEach((patient) => {
      createPatientCard(patient);
    });
  })
  .catch((error) => {
    console.error("JSON読み込み失敗", error);
  });

let selectMode = false;
let selectedUserId = new Set();
let users = [];

// 選択モード切り替え
document.addEventListener("DOMContentLoaded", () => {
  fetchUsers();
  document
    .getElementById("select-mode")
    .addEventListener("click", toggleSelectionMode);
  document
    .getElementById("select-all")
    .addEventListener("click", selectAllUsers);
  document.getElementById("delete-user").addEventListener("click", deleteUsers);
});
function toggleSelectionMode() {
  selectMode = !selectMode;

  // 選択状態をリセット
  // selectedUserId.clear();

  const selectModeBtn = document.getElementById("select-mode");
  const selectAllBtn = document.getElementById("select-all");
  const deleteBtn = document.getElementById("delete-user");
  const count = document.getElementById("selected-count");

  selectModeBtn.textContent = selectMode ? "キャンセル" : "選択";

  selectAllBtn.hidden = !selectMode;
  deleteBtn.hidden = !selectMode;
  count.hidden = !selectMode;

  // 選択モードを終了した場合は選択解除
  if (!selectMode) {
    selectedUserId.clear();
    updateSelectedCount();
  }
  // createPatientCard(users);
  renderUsers();
}
// 全選択
function selectAllUsers() {
  if (selectedUserId.size === users.length) {
    selectedUserId.clear();
  } else {
    users.forEach((user) => {
      selectedUserId.add(user.id);
    });
  }
  // createPatientCard(users);
  renderUsers();
  updateSelectedCount();
}
// 選択人数を更新
function updateSelectedCount() {
  document.getElementById("selected-count").textContent =
    `${selectedUserId.size}件選択中`;
}

// カード生成
function createPatientCard(patient) {
  if (!patient || !patient.id) {
    console.error("ユーザー情報が渡されていません", patient);
    return;
  }
  // console.log("createPatientCardに渡されたデータ:", patient);
  const card = document.createElement("div");
  card.className = "patient-card";
  card.innerHTML = `
    ${
      selectMode
        ? `<input
              type="checkbox"
              class="user-checkbox"
              ${selectedUserId.has(patient.id) ? "checked" : ""}
          >`
        : ""
    }
      <h3>${patient.name}</h3>
      <p>年齢: ${patient.age}</p>
    `;
  // チェックボックスの処理
  const checkbox = card.querySelector(".user-checkbox");

  if (checkbox) {
    checkbox.addEventListener("change", (event) => {
      event.stopPropagation();
      toggleUsersSelection(patient.id);
      updateSelectedCount();
    });

    checkbox.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  // クリック時
  card.addEventListener("click", () => {
    if (!selectMode) {
      openModal(patient);
    }
  });

  patientList.appendChild(card);
}

async function fetchUsers() {
  try {
    const response = await fetch("http://localhost:3000/users");
    // console.log("レスポンス:", response.status);

    if (!response.ok) {
      throw new Error("ユーザー情報を取得できませんでした");
    }

    users = await response.json();
    // console.log("取得したユーザー情報:", allPatients);

    renderUsers();
  } catch (error) {
    console.error("ユーザー取得エラー:", error);
  }
}

function renderUsers() {
  // console.log("表示するユーザー:", allPatients);
  // console.log("patientList:", patientList);

  if (!patientList) {
    console.error("patientListが取得できていません");
    return;
  }
  patientList.innerHTML = "";

  users.forEach((patient) => {
    createPatientCard(patient);
  });
}

function toggleUsersSelection(userId) {
  if (selectedUserId.has(userId)) {
    selectedUserId.delete(userId);
  } else {
    selectedUserId.add(userId);
  }
  updateSelectedCount();
  // console.log("現在選択されているユーザー:", [...selectedUserId]);
}

async function deleteUsers() {
  if (selectedUserId.size === 0) {
    alert("削除するユーザーを選択してください");
    return;
  }

  if (!confirm("選択したユーザーを削除しますか？")) {
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/users", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids: Array.from(selectedUserId),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message);
    }

    alert(data.message);

    selectedUserId.clear();
    await createPatientCard();
  } catch (error) {
    console.error("削除エラー:", error);
    alert("ユーザーを削除できませんでした");
  }
}

// モーダル表示
function openModal(patient) {
  detailArea.innerHTML = `
        <h2>利用者詳細</h2>
        <p><strong>メールアドレス:</strong> ${patient.mail_address}</p>
        <p><strong>パスワード:</strong> ********</p>
        <p><strong>名前:</strong> ${patient.name}</p>
        <p><strong>年齢:</strong> ${patient.age}</p>
        <p><strong>既往歴等:</strong> ${patient.emergency_note}</p>
    `;

  modal.style.display = "block";
}

document.getElementById("searchBtn").addEventListener("click", searchPatient);
document.getElementById("searchBox").addEventListener("input", searchPatient); // 入力時にも即時検索できるように連動

async function searchPatient() {
  const keyword = document.getElementById("searchBox").value.toLowerCase();
  const filtered = allPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(keyword) ||
      String(p.login_id).toLowerCase().includes(keyword),
  );
  displayPatients(filtered);
}

function displayPatients(patients) {
  patientList.innerHTML = "";
  patients.forEach((patient) => {
    createPatientCard(patient);
  });
}

// 閉じる
closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});

// モーダル外クリックで閉じる機能
window.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.style.display = "none";
  }
});
