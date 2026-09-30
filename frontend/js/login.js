import { $, toast } from "./app.js";
import { api } from "./api.js";

export function initLogin() {
  const btnFarmer = $("#btn-farmer-login");
  const btnAdmin = $("#btn-admin-login");
  const formFarmer = $("#form-farmer-login");
  const formAdmin = $("#form-admin-login");
  const loggedInView = $("#logged-in-view");
  const welcomeMsg = $("#welcome-message");
  const roleBadge = $("#role-badge");
  const btnLogout = $("#btn-logout");
  const loginToggle = $(".login-toggle");

  function updateUI() {
    const userType = localStorage.getItem("honeychain_user_type");
    const user = JSON.parse(localStorage.getItem("honeychain_user") || "null");

    if (userType && user) {
      if(formFarmer) formFarmer.hidden = true;
      if(formAdmin) formAdmin.hidden = true;
      if(loginToggle) loginToggle.hidden = true;
      if(loggedInView) loggedInView.hidden = false;
      
      const displayName = userType === 'farmer' ? user.name : user.admin_id;
      if(welcomeMsg) welcomeMsg.textContent = `Welcome back, ${displayName}!`;
      if(roleBadge) roleBadge.textContent = `Logged in as ${userType.toUpperCase()}`;
    } else {
      if(loginToggle) loginToggle.hidden = false;
      if(loggedInView) loggedInView.hidden = true;
      if(btnFarmer) btnFarmer.click(); // Reset to farmer tab
    }
  }

  btnFarmer?.addEventListener("click", () => {
    btnFarmer.classList.add("active");
    btnFarmer.classList.remove("ghost");
    btnAdmin.classList.remove("active");
    btnAdmin.classList.add("ghost");
    formFarmer.hidden = false;
    formAdmin.hidden = true;
  });

  btnAdmin?.addEventListener("click", () => {
    btnAdmin.classList.add("active");
    btnAdmin.classList.remove("ghost");
    btnFarmer.classList.remove("active");
    btnFarmer.classList.add("ghost");
    formAdmin.hidden = false;
    formFarmer.hidden = true;
  });

  formFarmer?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = formFarmer.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Authenticating...";
    try {
      const payload = {
        farmer_id: parseInt($("#farmer-id").value, 10),
        password: $("#farmer-password").value
      };
      
      const res = await api.post("/api/auth/farmer/login", payload);
      
      if (res.success) {
        localStorage.setItem("honeychain_user_type", "farmer");
        localStorage.setItem("honeychain_user", JSON.stringify(res.farmer));
        toast("Logged in as Farmer successfully", "good");
        updateUI();
        location.hash = "hive"; // Redirect to dashboard
      }
    } catch (err) {
      toast(err.message || "Login failed. Check your ID and password.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Login to Dashboard";
    }
  });

  formAdmin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = formAdmin.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Authenticating...";
    try {
      const payload = {
        admin_id: $("#admin-id").value,
        password: $("#admin-password").value
      };
      
      const res = await api.post("/api/auth/admin/login", payload);
      
      if (res.success) {
        localStorage.setItem("honeychain_user_type", "admin");
        localStorage.setItem("honeychain_user", JSON.stringify(res.admin));
        toast("Logged in as Admin successfully", "good");
        updateUI();
        location.hash = "admin"; // Redirect to admin dashboard
      }
    } catch (err) {
      toast(err.message || "Login failed. Check Admin ID and password.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Login as Admin";
    }
  });

  btnLogout?.addEventListener("click", () => {
    localStorage.removeItem("honeychain_user_type");
    localStorage.removeItem("honeychain_user");
    toast("Logged out securely.", "good");
    updateUI();
    
    // Clear forms
    if(formFarmer) formFarmer.reset();
    if(formAdmin) formAdmin.reset();
    
    location.hash = "login";
  });

  // Ensure UI is updated correctly on load
  updateUI();
}