(function(){
  rt_seedIfMissing();

  const form = document.getElementById("loginForm");
  const msg = document.getElementById("msg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msg.textContent = "";

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const res = rt_login(username, password);
    if (!res.ok) {
      msg.textContent = res.reason;
      return;
    }

    // Redirect based on role
    if (res.user.role === "admin") window.location.href = "admin.html";
    else window.location.href = "index.html";
  });
})();
