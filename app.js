import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- DOM refs ----------
const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const loginError = document.getElementById("loginError");
const btnLogout = document.getElementById("btnLogout");
const adminEmailLabel = document.getElementById("adminEmailLabel");

const searchBox = document.getElementById("searchBox");
const btnAddSubscriber = document.getElementById("btnAddSubscriber");
const tableBody = document.getElementById("subscriberTableBody");
const emptyState = document.getElementById("emptyState");

const pendingSection = document.getElementById("pendingSection");
const pendingList = document.getElementById("pendingList");

const statOverdue = document.getElementById("statOverdue");
const statDueSoon = document.getElementById("statDueSoon");
const statActive = document.getElementById("statActive");

const modal = document.getElementById("subscriberModal");
const modalTitle = document.getElementById("modalTitle");
const fieldName = document.getElementById("fieldName");
const fieldEmail = document.getElementById("fieldEmail");
const fieldDueDate = document.getElementById("fieldDueDate");
const fieldAmount = document.getElementById("fieldAmount");
const fieldStatus = document.getElementById("fieldStatus");
const btnSaveSubscriber = document.getElementById("btnSaveSubscriber");
const btnDeleteSubscriber = document.getElementById("btnDeleteSubscriber");
const btnCancelModal = document.getElementById("btnCancelModal");
const modalError = document.getElementById("modalError");

const toastEl = document.getElementById("toast");

let allSubscribers = []; // cached for search filtering
let editingDocId = null; // null = adding new
let unsubscribeSnapshot = null;
let unsubscribePending = null;
let pendingPrefillEmail = null; // set when confirming a pending registration

// ---------- Auth ----------
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
    showDashboard();
    subscribeToSubscribers();
    subscribeToPendingRegistrations();
  } else {
    if (user) {
      // Logged in, but not an authorized admin email
      showLoginError("This account is not authorized as admin.");
      signOut(auth);
    }
    showLogin();
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    if (unsubscribePending) { unsubscribePending(); unsubscribePending = null; }
  }
});

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loginEmail.value = "";
  loginPassword.value = "";
  requestNotificationPermission();
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

// ---------- Firestore: live subscriber list ----------
function subscribeToSubscribers() {
  unsubscribeSnapshot = onSnapshot(collection(db, "subscribers"), (snapshot) => {
    allSubscribers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderTable();
  }, (err) => {
    showToast("Failed to load subscribers: " + err.message);
  });
}

function renderTable() {
  const query = searchBox.value.trim().toLowerCase();
  const filtered = allSubscribers.filter((s) =>
    (s.name || "").toLowerCase().includes(query) ||
    (s.email || s.id || "").toLowerCase().includes(query)
  );

  // sort by due date ascending (soonest first), undated last
  filtered.sort((a, b) => {
    const aTime = a.dueDate ? a.dueDate.toMillis() : Infinity;
    const bTime = b.dueDate ? b.dueDate.toMillis() : Infinity;
    return aTime - bTime;
  });

  tableBody.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  let overdueCount = 0, dueSoonCount = 0, activeCount = 0;

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  filtered.forEach((s) => {
    const dueDate = s.dueDate ? s.dueDate.toDate() : null;
    let urgency = "none"; // none | due-soon | overdue
    if (dueDate && s.status !== "paid") {
      if (dueDate < now) urgency = "overdue";
      else if (dueDate <= threeDaysFromNow) urgency = "due-soon";
    }

    if (urgency === "overdue") overdueCount++;
    else if (urgency === "due-soon") dueSoonCount++;
    else if (s.status === "active") activeCount++;

    const tr = document.createElement("tr");
    if (urgency === "overdue") tr.classList.add("row-overdue");
    if (urgency === "due-soon") tr.classList.add("row-due-soon");
    tr.addEventListener("click", () => openEditModal(s));

    const dueDateText = dueDate
      ? dueDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
      : "Not set";

    const amountText = typeof s.monthlyAmount === "number"
      ? "₱" + s.monthlyAmount.toFixed(2)
      : "--";

    const badgeClass = urgency === "overdue" ? "badge-overdue"
      : urgency === "due-soon" ? "badge-due-soon"
      : s.status === "paid" ? "badge-paid" : "badge-active";

    const badgeText = urgency === "overdue" ? "Overdue"
      : urgency === "due-soon" ? "Due soon"
      : (s.status || "active");

    tr.innerHTML = `
      <td>${escapeHtml(s.name || "(no name)")}</td>
      <td>${escapeHtml(s.email || s.id)}</td>
      <td>${dueDateText}</td>
      <td>${amountText}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span></td>
      <td>›</td>
    `;
    tableBody.appendChild(tr);
  });

  statOverdue.textContent = overdueCount;
  statDueSoon.textContent = dueSoonCount;
  statActive.textContent = activeCount;

  maybeNotify(filtered, now, threeDaysFromNow);
}

searchBox.addEventListener("input", renderTable);

// ---------- Pending registrations ----------
function subscribeToPendingRegistrations() {
  unsubscribePending = onSnapshot(collection(db, "pendingRegistrations"), (snapshot) => {
    const pending = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPending(pending);
  }, (err) => {
    showToast("Failed to load pending registrations: " + err.message);
  });
}

function renderPending(pending) {
  pendingSection.hidden = pending.length === 0;
  pendingList.innerHTML = "";

  pending
    .sort((a, b) => (b.registeredAt?.toMillis() || 0) - (a.registeredAt?.toMillis() || 0))
    .forEach((p) => {
      const card = document.createElement("div");
      card.className = "pending-card";

      const dateText = p.registeredAt
        ? p.registeredAt.toDate().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" })
        : "";

      card.innerHTML = `
        <div class="pending-info">
          <span class="pending-email">${escapeHtml(p.email || p.id)}</span>
          <span class="pending-date">Registered ${dateText}</span>
        </div>
        <div class="pending-actions">
          <button class="btn btn-primary btn-sm" data-action="confirm">Confirm</button>
          <button class="btn btn-danger btn-sm" data-action="dismiss">Dismiss</button>
        </div>
      `;

      card.querySelector('[data-action="confirm"]').addEventListener("click", () => openConfirmModal(p));
      card.querySelector('[data-action="dismiss"]').addEventListener("click", () => dismissPending(p));

      pendingList.appendChild(card);
    });
}

function openConfirmModal(pending) {
  pendingPrefillEmail = pending.id;
  openAddModal();
  fieldEmail.value = pending.email || pending.id;
}

async function dismissPending(pending) {
  if (!confirm(`Dismiss registration for "${pending.email || pending.id}"? They'll still be able to log in, but won't appear here anymore unless they register again.`)) return;
  try {
    await deleteDoc(doc(db, "pendingRegistrations", pending.id));
    showToast("Dismissed.");
  } catch (err) {
    showToast("Failed to dismiss: " + err.message);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Add / Edit modal ----------
btnAddSubscriber.addEventListener("click", () => openAddModal());
btnCancelModal.addEventListener("click", closeModal);

function openAddModal() {
  editingDocId = null;
  pendingPrefillEmail = null;
  modalTitle.textContent = "Add subscriber";
  fieldName.value = "";
  fieldEmail.value = "";
  fieldEmail.disabled = false;
  fieldDueDate.value = "";
  fieldAmount.value = "";
  fieldStatus.value = "active";
  btnDeleteSubscriber.hidden = true;
  modalError.hidden = true;
  modal.hidden = false;
}

function openEditModal(subscriber) {
  editingDocId = subscriber.id;
  pendingPrefillEmail = null;
  modalTitle.textContent = "Edit subscriber";
  fieldName.value = subscriber.name || "";
  fieldEmail.value = subscriber.email || subscriber.id;
  fieldEmail.disabled = true; // email is the doc ID — changing it means creating a new doc
  fieldDueDate.value = subscriber.dueDate ? toDateInputValue(subscriber.dueDate.toDate()) : "";
  fieldAmount.value = typeof subscriber.monthlyAmount === "number" ? subscriber.monthlyAmount : "";
  fieldStatus.value = subscriber.status || "active";
  btnDeleteSubscriber.hidden = false;
  modalError.hidden = true;
  modal.hidden = false;
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function closeModal() {
  modal.hidden = true;
}

btnSaveSubscriber.addEventListener("click", async () => {
  const name = fieldName.value.trim();
  const email = fieldEmail.value.trim().toLowerCase();
  const dueDateStr = fieldDueDate.value;
  const amount = parseFloat(fieldAmount.value);
  const status = fieldStatus.value;

  if (!email) { showModalError("Email is required."); return; }
  if (!dueDateStr) { showModalError("Due date is required."); return; }

  const docId = editingDocId || email;

  const data = {
    name,
    email,
    dueDate: Timestamp.fromDate(new Date(dueDateStr + "T09:00:00")),
    monthlyAmount: isNaN(amount) ? 0 : amount,
    status
  };

  btnSaveSubscriber.disabled = true;
  try {
    await setDoc(doc(db, "subscribers", docId), data);
    if (pendingPrefillEmail) {
      await deleteDoc(doc(db, "pendingRegistrations", pendingPrefillEmail)).catch(() => {});
      pendingPrefillEmail = null;
    }
    closeModal();
    showToast("Saved.");
  } catch (err) {
    showModalError("Failed to save: " + err.message);
  } finally {
    btnSaveSubscriber.disabled = false;
  }
});

btnDeleteSubscriber.addEventListener("click", async () => {
  if (!editingDocId) return;
  if (!confirm(`Delete subscriber "${fieldName.value || editingDocId}"? This can't be undone.`)) return;

  try {
    await deleteDoc(doc(db, "subscribers", editingDocId));
    closeModal();
    showToast("Deleted.");
  } catch (err) {
    showModalError("Failed to delete: " + err.message);
  }
});

function showModalError(msg) {
  modalError.textContent = msg;
  modalError.hidden = false;
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2500);
}

// ---------- Browser notifications for admin ----------
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function maybeNotify(subscribers, now, threeDaysFromNow) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const todayKey = now.toISOString().slice(0, 10); // dedupe once per day per subscriber
  const notifiedKey = "rustech_tracker_notified_" + todayKey;
  const alreadyNotified = new Set(JSON.parse(localStorage.getItem(notifiedKey) || "[]"));

  subscribers.forEach((s) => {
    if (!s.dueDate || s.status === "paid") return;
    const dueDate = s.dueDate.toDate();
    const isOverdue = dueDate < now;
    const isDueSoon = !isOverdue && dueDate <= threeDaysFromNow;
    if (!isOverdue && !isDueSoon) return;

    const key = s.id;
    if (alreadyNotified.has(key)) return;

    const title = isOverdue ? "Subscriber overdue" : "Subscriber due soon";
    const body = `${s.name || s.email || s.id} — due ${dueDate.toLocaleDateString()}`;
    new Notification(title, { body });

    alreadyNotified.add(key);
  });

  localStorage.setItem(notifiedKey, JSON.stringify([...alreadyNotified]));
}
