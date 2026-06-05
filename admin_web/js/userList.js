const patientList = document.getElementById("patientList");

const modal = document.getElementById("modal");

const detailArea = document.getElementById("detailArea");

const closeBtn = document.getElementById("closeBtn");

// JSON読み込み
fetch("http://localhost:3000/users")
  .then((response) => response.json())

  .then((data) => {
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

        <p>ID: ${patient.login_id}</p>

        <p>パスワード: ${patient.password_hash}</p>

        <p>名前: ${patient.name}</p>

        <p>年齢: ${patient.age}</p>

        <p>既往歴等: ${patient.emergency_note}</p>

    `;

  modal.style.display = "block";
}

// 閉じる
closeBtn.addEventListener("click", () => {
  modal.style.display = "none";
});
