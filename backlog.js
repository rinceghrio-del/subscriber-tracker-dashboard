import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, onSnapshot, Timestamp, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM refs ----------
const loginView = document.getElementById("loginView");
const backlogView = document.getElementById("backlogView");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const loginError = document.getElementById("loginError");
const btnLogout = document.getElementById("btnLogout");
const adminEmailLabel = document.getElementById("adminEmailLabel");

const statPendingInstall = document.getElementById("statPendingInstall");
const statPendingRepair = document.getElementById("statPendingRepair");
const statDelayed = document.getElementById("statDelayed");
const statCompleted = document.getElementById("statCompleted");

const installList = document.getElementById("installList");
const installEmptyState = document.getElementById("installEmptyState");
const installSearchBox = document.getElementById("installSearchBox");
const btnAddInstall = document.getElementById("btnAddInstall");

const repairBacklogList = document.getElementById("repairBacklogList");
const repairEmptyState = document.getElementById("repairEmptyState");
const repairSearchBox = document.getElementById("repairSearchBox");
const btnAddRepair = document.getElementById("btnAddRepair");

const delayedList = document.getElementById("delayedList");
const delayedEmptyState = document.getElementById("delayedEmptyState");

const historyList = document.getElementById("historyList");
const historyEmptyState = document.getElementById("historyEmptyState");
const historySearchBox = document.getElementById("historySearchBox");

const installModal = document.getElementById("installModal");
const installName = document.getElementById("installName");
const installContact = document.getElementById("installContact");
const installAddress = document.getElementById("installAddress");
const installNotes = document.getElementById("installNotes");
const btnSaveInstall = document.getElementById("btnSaveInstall");
const btnCancelInstall = document.getElementById("btnCancelInstall");
const installModalError = document.getElementById("installModalError");

const repairModal = document.getElementById("repairModal");
const repairEmail = document.getElementById("repairEmail");
const repairIssue = document.getElementById("repairIssue");
const btnSaveRepair = document.getElementById("btnSaveRepair");
const btnCancelRepair = document.getElementById("btnCancelRepair");
const repairModalError = document.getElementById("repairModalError");

const toastEl = document.getElementById("toast");

let allInstalls = [];
let allRepairs = [];
let unsubscribeInstalls = null;
let unsubscribeRepairs = null;

// ---------- Auth (same pattern as the subscriber dashboard) ----------
btnLogin.addEventListener("click", handleLogin);
loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") handleLogin(); });

function handleLogin() {
  loginError.hidden = true;
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showLoginError("Please enter both email and password.");
    return;
  }

  btnLogin.disabled = true;
  signInWithEmailAndPassword(auth, email, password)
    .catch((err) => showLoginError(describeAuthError(err)))
    .finally(() => { btnLogin.disabled = false; });
}

btnLogout.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(user.email.toLowerCase())) {
    adminEmailLabel.textContent = user.email;
    showBacklog();
    subscribeToInstalls();
    subscribeToRepairs();
  } else {
    if (user) {
      showLoginError("This account is not authorized as admin.");
      signOut(auth);
    }
    showLogin();
    if (unsubscribeInstalls) { unsubscribeInstalls(); unsubscribeInstalls = null; }
    if (unsubscribeRepairs) { unsubscribeRepairs(); unsubscribeRepairs = null; }
  }
});

function showLogin() {
  loginView.hidden = false;
  backlogView.hidden = true;
}

function showBacklog() {
  loginView.hidden = true;
  backlogView.hidden = false;
  loginEmail.value = "";
  loginPassword.value = "";
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.hidden = false;
}

function describeAuthError(err) {
  switch (err.code) {
    case "auth/invalid-email": return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/invalid-credential":
    case "auth/wrong-password": return "Incorrect email or password.";
    case "auth/too-many-requests": return "Too many attempts. Please wait and try again.";
    default: return "Login failed: " + err.message;
  }
}

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
  });
});

// ---------- Firestore: live install requests ----------
function subscribeToInstalls() {
  unsubscribeInstalls = onSnapshot(collection(db, "installRequests"), (snapshot) => {
    allInstalls = snapshot.docs.map((d) => ({ id: d.id, type: "install", ...d.data() }));
    renderAll();
  }, (err) => {
    showToast("Failed to load install requests: " + err.message);
  });
}

// ---------- Firestore: live repair requests (same collection the main dashboard uses) ----------
function subscribeToRepairs() {
  unsubscribeRepairs = onSnapshot(collection(db, "repairRequests"), (snapshot) => {
    allRepairs = snapshot.docs.map((d) => ({ id: d.id, type: "repair", ...d.data() }));
    renderAll();
  }, (err) => {
    showToast("Failed to load repair requests: " + err.message);
  });
}

function renderAll() {
  renderInstallTab();
  renderRepairTab();
  renderDelayedTab();
  renderHistoryTab();
  updateSummary();
}

function updateSummary() {
  statPendingInstall.textContent = allInstalls.filter(i => i.status === "pending").length;
  statPendingRepair.textContent = allRepairs.filter(r => r.status === "pending").length;

  const now = new Date();
  const delayedCount = [...allInstalls, ...allRepairs].filter(
    item => item.status === "scheduled" && item.scheduledDate && item.scheduledDate.toDate() < now
  ).length;
  statDelayed.textContent = delayedCount;

  const completedCount = [...allInstalls, ...allRepairs].filter(
    item => item.status === "completed" || item.status === "cancelled"
  ).length;
  statCompleted.textContent = completedCount;
}

// ---------- Card rendering (shared by install + repair queues) ----------
function contactLabel(item) {
  return item.type === "install" ? (item.name || item.contact || "") : (item.email || "");
}

function detailLabel(item) {
  return item.type === "install" ? (item.address || item.notes || "") : (item.issue || "");
}

function buildCard(item, { showActions = true, showTypeTag = false } = {}) {
  const requestedText = item.requestedAt
    ? item.requestedAt.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
    : "";

  const badgeClass = item.status === "scheduled" ? "badge-scheduled"
    : item.status === "completed" ? "badge-completed"
    : item.status === "cancelled" ? "badge-cancelled"
    : "badge-due-soon";

  const isDelayed = item.status === "scheduled" && item.scheduledDate && item.scheduledDate.toDate() < new Date();
  const finalBadgeClass = isDelayed ? "badge-overdue" : badgeClass;
  const badgeText = isDelayed ? "Delayed" : (item.status === "pending" ? "Pending" : capitalize(item.status));

  const scheduledInputValue = item.scheduledDate ? toDateTimeLocalValue(item.scheduledDate.toDate()) : "";
  const scheduledDisplay = item.scheduledDate
    ? item.scheduledDate.toDate().toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "numeric", minute: "2-digit" })
    : "";

  const card = document.createElement("div");
  card.className = "pending-card repair-card";
  const borderColor = isDelayed ? "var(--danger)"
    : item.status === "scheduled" ? "#5b9cf6"
    : item.status === "completed" ? "var(--accent)"
    : item.status === "cancelled" ? "var(--border)"
    : "var(--warn)";
  card.style.borderColor = borderColor;

  const typeTag = showTypeTag ? `<span class="type-tag">${item.type}</span>` : "";

  card.innerHTML = `
    <div class="pending-info">
      <span class="pending-email">${typeTag}${escapeHtml(contactLabel(item))} <span class="badge ${finalBadgeClass}">${badgeText}</span></span>
      <span class="pending-date">Requested ${requestedText}</span>
      <p class="repair-issue">${escapeHtml(detailLabel(item))}</p>
      ${item.status === "scheduled" || item.status === "completed" ? (scheduledDisplay ? `<span class="pending-date">Scheduled: ${scheduledDisplay}</span>` : "") : ""}
    </div>
    ${showActions ? `
    <div class="pending-actions" style="flex-direction: column; align-items: stretch;">
      <div class="repair-schedule-row">
        <input type="datetime-local" class="item-datetime" value="${scheduledInputValue}" />
        <button class="btn btn-primary btn-sm" data-action="schedule">${item.status === "scheduled" ? "Reschedule" : "Schedule"}</button>
      </div>
      <div class="repair-schedule-row">
        ${item.status === "scheduled" ? '<button class="btn btn-ghost btn-sm" data-action="complete">Mark Completed</button>' : ""}
        <button class="btn btn-danger btn-sm" data-action="cancel">Cancel</button>
      </div>
    </div>` : ""}
  `;

  if (showActions) {
    card.querySelector('[data-action="schedule"]').addEventListener("click", () => {
      const val = card.querySelector(".item-datetime").value;
      if (!val) { showToast("Pick a date/time first."); return; }
      scheduleItem(item.type, item.id, val);
    });
    const completeBtn = card.querySelector('[data-action="complete"]');
    if (completeBtn) completeBtn.addEventListener("click", () => setItemStatus(item.type, item.id, "completed"));
    card.querySelector('[data-action="cancel"]').addEventListener("click", () => {
      if (!confirm("Cancel this request?")) return;
      setItemStatus(item.type, item.id, "cancelled");
    });
  }

  return card;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function toDateTimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function collectionNameFor(type) {
  return type === "install" ? "installRequests" : "repairRequests";
}

async function scheduleItem(type, id, dateTimeLocalValue) {
  try {
    await updateDoc(doc(db, collectionNameFor(type), id), {
      status: "scheduled",
      scheduledDate: Timestamp.fromDate(new Date(dateTimeLocalValue))
    });
    showToast("Scheduled.");
  } catch (err) {
    showToast("Failed to schedule: " + err.message);
  }
}

async function setItemStatus(type, id, status) {
  try {
    await updateDoc(doc(db, collectionNameFor(type), id), { status });
    showToast(status === "completed" ? "Marked completed." : "Request cancelled.");
  } catch (err) {
    showToast("Failed to update: " + err.message);
  }
}

// ---------- Install tab ----------
function renderInstallTab() {
  const query = installSearchBox.value.trim().toLowerCase();
  const active = allInstalls
    .filter(i => i.status === "pending" || i.status === "scheduled")
    .filter(i => contactLabel(i).toLowerCase().includes(query) || (i.contact || "").toLowerCase().includes(query))
    .sort((a, b) => (a.requestedAt?.toMillis() || 0) - (b.requestedAt?.toMillis() || 0));

  installList.innerHTML = "";
  installEmptyState.hidden = active.length > 0;
  active.forEach((i) => installList.appendChild(buildCard(i)));
}
installSearchBox.addEventListener("input", renderInstallTab);

// ---------- Repair tab ----------
function renderRepairTab() {
  const query = repairSearchBox.value.trim().toLowerCase();
  const active = allRepairs
    .filter(r => r.status === "pending" || r.status === "scheduled")
    .filter(r => contactLabel(r).toLowerCase().includes(query) || (r.issue || "").toLowerCase().includes(query))
    .sort((a, b) => (a.requestedAt?.toMillis() || 0) - (b.requestedAt?.toMillis() || 0));

  repairBacklogList.innerHTML = "";
  repairEmptyState.hidden = active.length > 0;
  active.forEach((r) => repairBacklogList.appendChild(buildCard(r)));
}
repairSearchBox.addEventListener("input", renderRepairTab);

// ---------- Delayed tab ----------
function renderDelayedTab() {
  const now = new Date();
  const delayed = [...allInstalls, ...allRepairs]
    .filter(item => item.status === "scheduled" && item.scheduledDate && item.scheduledDate.toDate() < now)
    .sort((a, b) => (a.scheduledDate?.toMillis() || 0) - (b.scheduledDate?.toMillis() || 0)); // most overdue first

  delayedList.innerHTML = "";
  delayedEmptyState.hidden = delayed.length > 0;
  delayed.forEach((item) => delayedList.appendChild(buildCard(item, { showTypeTag: true })));
}

// ---------- History tab ----------
function renderHistoryTab() {
  const query = historySearchBox.value.trim().toLowerCase();
  const history = [...allInstalls, ...allRepairs]
    .filter(item => item.status === "completed" || item.status === "cancelled")
    .filter(item => contactLabel(item).toLowerCase().includes(query) || detailLabel(item).toLowerCase().includes(query))
    .sort((a, b) => (b.requestedAt?.toMillis() || 0) - (a.requestedAt?.toMillis() || 0)); // newest first

  historyList.innerHTML = "";
  historyEmptyState.hidden = history.length > 0;
  history.forEach((item) => historyList.appendChild(buildCard(item, { showActions: false, showTypeTag: true })));
}
historySearchBox.addEventListener("input", renderHistoryTab);

// ---------- Add install modal ----------
btnAddInstall.addEventListener("click", () => {
  installName.value = "";
  installContact.value = "";
  installAddress.value = "";
  installNotes.value = "";
  installModalError.hidden = true;
  installModal.hidden = false;
});
btnCancelInstall.addEventListener("click", () => { installModal.hidden = true; });

btnSaveInstall.addEventListener("click", async () => {
  const name = installName.value.trim();
  const contact = installContact.value.trim();
  const address = installAddress.value.trim();
  const notes = installNotes.value.trim();

  if (!name) { installModalError.textContent = "Customer name is required."; installModalError.hidden = false; return; }
  if (!contact) { installModalError.textContent = "Contact is required."; installModalError.hidden = false; return; }

  btnSaveInstall.disabled = true;
  try {
    await addDoc(collection(db, "installRequests"), {
      name, contact, address, notes,
      status: "pending",
      requestedAt: serverTimestamp(),
      scheduledDate: null
    });
    installModal.hidden = true;
    showToast("Install request added.");
  } catch (err) {
    installModalError.textContent = "Failed to save: " + err.message;
    installModalError.hidden = false;
  } finally {
    btnSaveInstall.disabled = false;
  }
});

// ---------- Add repair modal ----------
btnAddRepair.addEventListener("click", () => {
  repairEmail.value = "";
  repairIssue.value = "";
  repairModalError.hidden = true;
  repairModal.hidden = false;
});
btnCancelRepair.addEventListener("click", () => { repairModal.hidden = true; });

btnSaveRepair.addEventListener("click", async () => {
  const email = repairEmail.value.trim();
  const issue = repairIssue.value.trim();

  if (!email) { repairModalError.textContent = "Customer name / email is required."; repairModalError.hidden = false; return; }
  if (!issue) { repairModalError.textContent = "Issue is required."; repairModalError.hidden = false; return; }

  btnSaveRepair.disabled = true;
  try {
    await addDoc(collection(db, "repairRequests"), {
      email, issue,
      status: "pending",
      requestedAt: serverTimestamp(),
      scheduledDate: null
    });
    repairModal.hidden = true;
    showToast("Repair request added.");
  } catch (err) {
    repairModalError.textContent = "Failed to save: " + err.message;
    repairModalError.hidden = false;
  } finally {
    btnSaveRepair.disabled = false;
  }
});

// ---------- Helpers ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2500);
}
