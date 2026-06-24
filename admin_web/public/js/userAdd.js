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
      .then((response) => response.text())
      .then((data) => {
        alert(data);
        window.location.href = "../home.html";
      })
      .catch((error) => {
        console.log(error);
      });
  }
}
