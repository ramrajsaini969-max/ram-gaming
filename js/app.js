import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBcOqJ9rjchCaJgKZ0ck2r1-i9ZlpCaf4",
  authDomain: "ram-gaming.firebaseapp.com",
  projectId: "ram-gaming",
  storageBucket: "ram-gaming.firebasestorage.app",
  messagingSenderId: "242230524703",
  appId: "1:242230524703:web:e55f74b1c8cd178bd58e2a"
};

const ADMIN_EMAIL = "ramrajsaini969@gmail.com";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const $ = id => document.getElementById(id);
const show = id => $(id)?.classList.remove("hidden");
const hide = id => $(id)?.classList.add("hidden");

let currentUser = null;
let selectedTournament = null;
let tournaments = [
  { id: "br", type: "BR", title: "BR Duo Tournament", fee: 50, date: "", time: "", prize: "Prize details announced in the group", status: "Open", rules: "Confirm schedule and room details with organizer." },
  { id: "cs", type: "CS", title: "CS Tournament", fee: 50, date: "", time: "", prize: "Prize details announced in the group", status: "Open", rules: "Confirm schedule and room details with organizer." }
];

function say(message) {
  const toast = $("toast");
  if (toast) toast.textContent = message;
}

function isAdmin(user = currentUser) {
  return Boolean(user && user.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    user.emailVerified === true);
}

async function loadTournaments() {
  try {
    const snap = await getDoc(doc(db, "site", "tournaments"));
    if (snap.exists() && Array.isArray(snap.data().items) && snap.data().items.length) {
      const saved = snap.data().items;
      tournaments = ["br", "cs"].map(id => {
        const old = tournaments.find(t => t.id === id);
        const found = saved.find(t => t.id === id);
        return found ? { ...old, ...found } : old;
      });
    } else {
      // Preserve the old single-tournament record if this site used the earlier version.
      const legacy = await getDoc(doc(db, "site", "tournament"));
      if (legacy.exists()) {
        tournaments[0] = { ...tournaments[0], ...legacy.data(), id: "br", type: "BR" };
      }
    }
  } catch (error) {
    console.error("Tournament load failed:", error);
    say("Could not load tournaments. Check Firestore Rules and connection.");
  }
  renderTournaments();
}

function renderTournaments() {
  const cards = $("cards");
  cards.replaceChildren();
  tournaments.forEach(t => {
    const article = document.createElement("article");
    article.className = "tournament";
    const status = document.createElement("span");
    status.className = "eyebrow";
    status.textContent = `${t.type} · ${String(t.status).toUpperCase()}`;
    const title = document.createElement("h3");
    title.textContent = t.title;
    const fee = document.createElement("p");
    fee.className = "fee";
    fee.textContent = `₹${t.fee} per duo`;
    const meta = document.createElement("p");
    meta.textContent = `${t.date || "Date to be announced"} · ${t.time || "Time to be announced"}`;
    const prize = document.createElement("p");
    prize.textContent = t.prize || "Prize details announced in the group";
    const rules = document.createElement("p");
    rules.textContent = t.rules || "";
    const join = document.createElement("button");
    join.className = "btn";
    join.textContent = t.status === "Open" ? "Register Team →" : "Registration Closed";
    join.disabled = t.status !== "Open";
    join.onclick = () => {
      selectedTournament = t;
      if (!currentUser) {
        show("login");
        say("Continue with Google to register.");
        return;
      }
      $("selected").textContent = `${t.title} · Entry ₹${t.fee}`;
      show("team");
    };
    article.append(status, title, fee, meta, prize, rules, join);
    cards.append(article);
  });
}

function buildAdminEditor() {
  const editor = $("editor");
  editor.replaceChildren();

  const intro = document.createElement("p");
  intro.textContent = "Edit BR and CS details below. Changes are published for all visitors.";
  editor.append(intro);

  const grid = document.createElement("div");
  grid.className = "admin-tournament-grid";

  tournaments.forEach(t => {
    const card = document.createElement("section");
    card.className = "admin-tournament";
    const heading = document.createElement("h3");
    heading.textContent = `${t.type} Tournament`;
    card.append(heading);

    const fields = [
      ["title", "Tournament title", "text"],
      ["fee", "Entry fee (₹)", "number"],
      ["date", "Date", "date"],
      ["time", "Time", "time"],
      ["prize", "Prize details", "text"],
      ["status", "Status", "select"],
      ["rules", "Rules", "textarea"]
    ];
    fields.forEach(([key, labelText, type]) => {
      const label = document.createElement("label");
      label.textContent = labelText;
      let input;
      if (type === "select") {
        input = document.createElement("select");
        ["Open", "Full", "Closed"].forEach(value => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          input.append(option);
        });
      } else if (type === "textarea") {
        input = document.createElement("textarea");
      } else {
        input = document.createElement("input");
        input.type = type;
        if (type === "number") input.min = "0";
        input.maxLength = key === "prize" ? 300 : 100;
      }
      input.id = `${t.id}-${key}`;
      input.value = t[key] ?? "";
      label.append(input);
      card.append(label);
    });

    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn";
    save.textContent = `Save ${t.type} details`;
    save.onclick = () => saveTournament(t.id);
    card.append(save);
    grid.append(card);
  });

  editor.append(grid);

  const regsHeading = document.createElement("h3");
  regsHeading.textContent = "Team registrations";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "btn outline";
  refresh.textContent = "Refresh registrations";
  refresh.onclick = loadRegistrations;
  const regs = document.createElement("div");
  regs.id = "registrations";
  editor.append(regsHeading, refresh, regs);
}

async function saveTournament(id) {
  if (!isAdmin()) {
    say("Admin access required.");
    return;
  }
  const old = tournaments.find(t => t.id === id);
  if (!old) return;

  const updated = {
    id: old.id,
    type: old.type,
    title: $(`${id}-title`).value.trim(),
    fee: Number($(`${id}-fee`).value),
    date: $(`${id}-date`).value,
    time: $(`${id}-time`).value,
    prize: $(`${id}-prize`).value.trim(),
    status: $(`${id}-status`).value,
    rules: $(`${id}-rules`).value.trim()
  };
  if (!updated.title || !Number.isFinite(updated.fee) || updated.fee < 0) {
    say("Enter a valid title and fee.");
    return;
  }
  const next = tournaments.map(t => t.id === id ? updated : t);
  try {
    await setDoc(doc(db, "site", "tournaments"), {
      items: next,
      updatedAt: serverTimestamp()
    });
    tournaments = next;
    renderTournaments();
    say(`${updated.type} tournament details saved.`);
  } catch (error) {
    console.error("Tournament save failed:", error);
    say("Save failed. Confirm the admin Gmail and Firestore Rules.");
  }
}

async function loadRegistrations() {
  if (!isAdmin()) {
    say("Admin access required.");
    return;
  }
  try {
    const snapshot = await getDocs(collection(db, "registrations"));
    const container = $("registrations");
    container.replaceChildren();
    if (snapshot.empty) {
      container.textContent = "No registrations yet.";
      return;
    }
    snapshot.forEach(item => {
      const data = item.data();
      const card = document.createElement("article");
      card.className = "registration-card";
      const heading = document.createElement("h4");
      heading.textContent = `${data.tournament || "Tournament"} — ${data.team || "Team"}`;
      const details = document.createElement("p");
      details.textContent = `Email: ${data.email || ""} · Players: ${data.p1 || ""} (${data.uid1 || ""}) + ${data.p2 || ""} (${data.uid2 || ""})`;
      const payment = document.createElement("p");
      payment.textContent = `Payment reference: ${data.utr || ""}`;
      const status = document.createElement("p");
      status.textContent = `Status: ${data.status || "Pending"}`;
      card.append(heading, details, payment, status);
      container.append(card);
    });
  } catch (error) {
    console.error("Registration load failed:", error);
    say("Could not load registrations. Check Firestore Rules.");
  }
}

$("menu").onclick = () => $("nav").classList.toggle("open");
$("loginOpen").onclick = () => show("login");
document.querySelectorAll("[data-close]").forEach(button => {
  button.onclick = () => hide(button.dataset.close);
});

$("googleLogin").onclick = async () => {
  try {
    await signInWithPopup(auth, provider);
    hide("login");
    // onAuthStateChanged will open the dashboard automatically for the authorized admin.
    say("Google login successful.");
  } catch (error) {
    console.error("Google login failed:", error);
    say("Login failed: " + (error.message || "Please try again."));
  }
};

$("logout").onclick = async () => {
  try {
    await signOut(auth);
    hide("admin");
    hide("login");
    say("Signed out.");
  } catch (error) {
    console.error(error);
    say("Sign out failed.");
  }
};

$("adminOpen").onclick = () => {
  if (isAdmin()) {
    show("admin");
    show("editor");
    return;
  }
  show("admin");
  hide("editor");
  $("adminmsg").textContent = currentUser
    ? `Signed in as ${currentUser.email || "unknown account"}. This account is not authorized as admin.`
    : "Sign in with your authorized admin Google account to open the dashboard.";
  if (!currentUser) show("login");
};

onAuthStateChanged(auth, async user => {
  currentUser = user;
  $("loginOpen").textContent = user ? `Google: ${user.displayName || user.email}` : "Google Login";
  $("logout").hidden = !user;

  if (user && isAdmin(user)) {
    $("adminmsg").textContent = `Admin account verified: ${user.email}`;
    show("editor");
    buildAdminEditor();
    show("admin");
    hide("login");
  } else {
    hide("editor");
    if (user) {
      $("adminmsg").textContent = `Signed in as ${user.email || "unknown account"}. This account is not authorized as admin.`;
    } else {
      $("adminmsg").textContent = "Sign in with your authorized admin Google account.";
    }
  }
});

$("teamform").onsubmit = async event => {
  event.preventDefault();
  if (!currentUser) {
    show("login");
    say("Login with Google first.");
    return;
  }
  if (!selectedTournament) {
    say("Choose a tournament first.");
    return;
  }
  const form = new FormData(event.currentTarget);
  const data = {
    uid: currentUser.uid,
    email: currentUser.email || "",
    tournament: selectedTournament.title,
    team: String(form.get("team") || "").trim(),
    p1: String(form.get("p1") || "").trim(),
    uid1: String(form.get("uid1") || "").trim(),
    p2: String(form.get("p2") || "").trim(),
    uid2: String(form.get("uid2") || "").trim(),
    utr: String(form.get("utr") || "").trim(),
    status: "Pending verification",
    createdAt: serverTimestamp()
  };
  try {
    await addDoc(collection(db, "registrations"), data);
    hide("team");
    event.currentTarget.reset();
    say("Registration submitted. Payment still needs organizer verification.");
  } catch (error) {
    console.error("Registration failed:", error);
    say("Registration failed: " + (error.code || error.message));
  }
};

$("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText("9376090619@fam");
    say("UPI ID copied.");
  } catch {
    say("UPI ID: 9376090619@fam");
  }
};

loadTournaments();
