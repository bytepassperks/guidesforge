// GuidesForge Chrome Extension - Popup Script

const API_BASE = "https://guidesforge-api.onrender.com/api";

const loginState = document.getElementById("login-state");
const idleState = document.getElementById("idle-state");
const recordingState = document.getElementById("recording-state");
const doneState = document.getElementById("done-state");
const userInfo = document.getElementById("user-info");

const loginBtn = document.getElementById("login-btn");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginError = document.getElementById("login-error");

const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const cancelBtn = document.getElementById("cancel-btn");
const newBtn = document.getElementById("new-btn");
const titleInput = document.getElementById("guide-title");
const stepsCount = document.getElementById("steps-count");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

function showState(state) {
  loginState.classList.toggle("hidden", state !== "login");
  idleState.classList.toggle("hidden", state !== "idle");
  recordingState.classList.toggle("hidden", state !== "recording");
  doneState.classList.toggle("hidden", state !== "done");
  // Show user info when logged in (any state except login)
  userInfo.classList.toggle("hidden", state === "login");
}

// Check current state on popup open
async function init() {
  const { authToken, userEmail } = await chrome.storage.local.get(["authToken", "userEmail"]);

  if (!authToken) {
    showState("login");
    return;
  }

  // Set user email display
  if (userEmail) {
    userEmailEl.textContent = userEmail;
  }

  // Check if currently recording
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
    if (chrome.runtime.lastError) {
      showState("idle");
      return;
    }
    if (response && response.isRecording) {
      showState("recording");
      stepsCount.textContent = response.stepsCount || "0";
    } else {
      showState("idle");
    }
  });
}

init();

// Login
loginBtn.addEventListener("click", async () => {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginError.textContent = "Please enter email and password";
    loginError.classList.remove("hidden");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";
  loginError.classList.add("hidden");

  try {
    const res = await fetch(API_BASE + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || "Invalid email or password");
    }

    const data = await res.json();
    const token = data.access_token;

    // Store token and email
    await chrome.storage.local.set({
      authToken: token,
      userEmail: email,
    });

    // Also tell background script
    chrome.runtime.sendMessage({ type: "SET_AUTH_TOKEN", token });

    userEmailEl.textContent = email;
    showState("idle");
  } catch (err) {
    loginError.textContent = err.message || "Login failed";
    loginError.classList.remove("hidden");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign In";
  }
});

// Allow Enter key to submit login
loginPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});
loginEmail.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginPassword.focus();
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["authToken", "userEmail"]);
  showState("login");
});

// Start recording
startBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim() || "Untitled Guide";

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Inject content script if not already injected
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "PING" });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  }

  chrome.runtime.sendMessage(
    { type: "START_RECORDING", title, tabId: tab.id },
    () => {
      showState("recording");
      stepsCount.textContent = "0";

      // Start rrweb in content script
      chrome.tabs.sendMessage(tab.id, { type: "START_RRWEB" });
    }
  );
});

// Stop recording
stopBtn.addEventListener("click", () => {
  stopBtn.disabled = true;
  stopBtn.textContent = "Uploading...";
  chrome.runtime.sendMessage({ type: "STOP_RECORDING" }, (response) => {
    stopBtn.disabled = false;
    showState("done");
  });
});

// Cancel recording
cancelBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "CANCEL_RECORDING" }, () => {
    showState("idle");
  });
});

// New recording
newBtn.addEventListener("click", () => {
  showState("idle");
  titleInput.value = "";
});

// Poll for step count updates while recording
setInterval(() => {
  if (!recordingState.classList.contains("hidden")) {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.stepsCount !== undefined) {
        stepsCount.textContent = String(response.stepsCount);
      }
    });
  }
}, 1000);
