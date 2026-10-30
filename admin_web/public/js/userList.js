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

// カード生成
function createPatientCard(patient) {
  const card = document.createElement("div");
  card.className = "patient-card";
  card.innerHTML = `
        <h3>${patient.name}</h3>
        <p>年齢: ${patient.age}</p>
    `;

  // クリック時
  card.addEventListener("click", () => {
    openModal(patient);
  });

  patientList.appendChild(card);
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
      String(p.login_id).toLowerCase().includes(keyword)
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