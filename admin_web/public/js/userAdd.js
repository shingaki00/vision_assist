//const { response } = require("express");

document.getElementById("touroku").addEventListener("click", registerUser);
function registerUser(event) {
  event.preventDefault();

  const userData = {
    mail_address: document.getElementById("mail_address").value,
    password: document.getElementById("password").value,
    name: document.getElementById("name").value,
    age: document.getElementById("age").value,
    emergency_note: document.getElementById("emergency_note").value,
  };

  console.log(userData);
  let flg = true;

  if (isNaN(userData.age) || userData.age < 0 || userData.age > 150) {
    alert("年齢を正しく入力してください");
    return;
  }

  if (
    userData.name.length === 0 ||
    userData.age.length === 0 ||
    userData.emergency_note.length === 0 ||
    userData.mail_address.length === 0 ||
    userData.password.length === 0
  ) {
    alert("必須項目が未記入の箇所があります");
    return;
  } else {
    fetch("http://localhost:3000/addUser", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(userData),
    })
<<<<<<< HEAD
      .then((response) => {
=======

    .then((response) => {
>>>>>>> b104a26aebb1938d3c0fa770f7f8fe9e53969927
        if (!response.ok) throw new Error("登録失敗");
        return response.text();
      })
      .then(() => {
        alert("登録が完了しました");
        window.location.href = "../pages/userList.html";
      })
      .catch((error) => {
        console.error(error);
        alert("登録に失敗しました。もう一度お試しください");
<<<<<<< HEAD
      });
=======
    });
>>>>>>> b104a26aebb1938d3c0fa770f7f8fe9e53969927
  }
}
