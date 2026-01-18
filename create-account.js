(function(){
  rt_seedIfMissing();

  const form = document.getElementById("createForm");
  const msg = document.getElementById("msg");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    msg.textContent = "";

    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;

    const res = rt_createPendingAccount(username, password);
    if (!res.ok) {
      msg.textContent = res.reason;
      return;
    }

    msg.style.color = "#34d399";
    msg.textContent = "Account request submitted. Please ask admin to approve your access.";
    form.reset();
  });
})();
