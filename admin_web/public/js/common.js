document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("dark") === "on") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
});
