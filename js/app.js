
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCBcOqJ9rjchCaJgKZ0ck2r1-i9ZlpCaf4",
  authDomain: "ram-gaming.firebaseapp.com",
  projectId: "ram-gaming",
  storageBucket: "ram-gaming.firebasestorage.app",
  messagingSenderId: "242230524703",
  appId: "1:242230524703:web:e55f74b1c8cd178bd58e2a"
};

const ADMIN_EMAIL = "ramraj969@gmail.com";
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const $ = id => document.getElementById(id);
const show = id => $(id)?.classList.remove("hidden");
const hide = id => $(id)?.classList.add("hidden");

let tournament = {
  title: "BR Duo Tournament",
  fee: 50,
  date: "",
  time: "",
  prize: "Prize details announced in the group",
  status: "Open",
  rules: "Confirm schedule and room details with organizer."
};

let currentUser = null;

function say(message) {
  $("toast").textContent = message;
}

function isAdmin(user = currentUser) {
  return Boolean(
    user &&
    user.email === ADMIN_EMAIL &&
    user.emailVerified
  );
}

async function loadTournament() {
  try {
    const snap = await getDoc(doc(db, "site", "tournament"));
    if (snap.exists()) tournament = { ...tournament, ...snap.data() };
  } catch (error) {
    console.error(error);
    say("Tournament details could not load. Check Firestore Rules.");
  }
  renderTournament();
}

function renderTournament() {
  const cards = $("cards");
  cards.replaceChildren();

  const article = document.createElement("article");
  article.className = "tournament";

  const status = document.createElement("span");
  status.className = "eyebrow";
  status.textContent = String(tournament.status).toUpperCase();

  const title = document.createElement("h3");
  title.textContent = tournament.title;

  const fee = document.createElement("p");
  fee.className = "fee";
  fee.textContent = "₹" + tournament.fee;

  const meta = document.createElement("p");
  meta.textContent =
    (tournament.date || "Date to be announced") +
    " · " +
    (tournament.time || "Time to be announced");

  const prize = document.createElement("p");
  prize.textContent = tournament.prize;

  const rules = document.createElement("p");
  rules.textContent = tournament.rules;

  const join = document.createElement("button");
  join.className = "btn";
  join.textContent = tournament.status === "Open"
    ? "Register Team →"
    : "Registration Closed";
  join.disabled = tournament.status !== "Open";

  join.onclick = () => {
    if (!currentUser) {
      show("login");
      say("Continue with Google to register.");
      return;
    }

    $("selected").textContent =
      tournament.title + " · Entry ₹" + tournament.fee;
    show("team");
  };

  article.append(status, title, fee, meta, prize, rules, join);
  cards.append(article);
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
    say("Google Login successful.");
  } catch (error) {
    console.error(error);
    say("Login failed: " + error.message);
  }
};

$("logout").onclick = async () => {
  try {
    await signOut(auth);
    hide("admin");
    hide("login");
    say("Signed out.");
  } catch (error) {
    say("Sign out failed.");
  }
};

onAuthStateChanged(auth, async user => {
  currentUser = user;

  $("loginOpen").textContent = user
    ? "Google: " + (user.displayName || user.email)
    : "Google Login";

  $("logout").hidden = !user;

  if (user) {
    hide("login");
    if (isAdmin(user)) {
      $("adminmsg").textContent = "Admin account verified.";
      show("editor");
      await fillEditor();
    } else {
      hide("editor");
    }
  } else {
    hide("editor");
    $("adminmsg").textContent =
      "Sign in with the authorized admin Google account.";
  }
});

async function fillEditor() {
  if (!isAdmin()) return;

  ["title", "fee", "date", "time", "prize", "status", "rules"]
    .forEach(key => {
      $(key).value = tournament[key] ?? "";
    });
}

$("save").onclick = async () => {
  if (!isAdmin()) {
    say("Admin access required.");
    return;
  }

  const updated = {
    title: $("title").value.trim(),
    fee: Number($("fee").value),
    date: $("date").value,
    time: $("time").value,
    prize: $("prize").value.trim(),
    status: $("status").value,
    rules: $("rules").value.trim()
  };

  if (!updated.title || !Number.isFinite(updated.fee) || updated.fee < 0) {
    say("Enter a valid tournament title and fee.");
    return;
  }

  try {
    await setDoc(doc(db, "site", "tournament"), updated);
    tournament = updated;
    renderTournament();
    say("Tournament details saved.");
  } catch (error) {
    console.error(error);
    say("Save failed. Firestore Rules must allow admin writes.");
  }
};

$("teamform").onsubmit = async event => {
  event.preventDefault();

  if (!currentUser) {
    show("login");
    say("Login with Google first.");
    return;
  }

  const form = new FormData(event.currentTarget);
  const data = {
    uid: currentUser.uid,
    email: currentUser.email || "",
    tournament: tournament.title,
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
    console.error(error);
    say("Registration failed. Firestore Rules need to be configured.");
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

$("adminOpen")?.remove();

$("refreshRegs").onclick = async () => {
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
      const heading = document.createElement("h4");
      heading.textContent = data.team || "Team";

      const details = document.createElement("p");
      details.textContent =
        `Players: ${data.p1 || ""} (${data.uid1 || ""}) + ` +
        `${data.p2 || ""} (${data.uid2 || ""})`;

      const payment = document.createElement("p");
      payment.textContent = `Payment reference: ${data.utr || ""}`;

      const status = document.createElement("p");
      status.textContent = `Status: ${data.status || "Pending"}`;

      card.append(heading, details, payment, status);
      container.append(card);
    });
  } catch (error) {
    console.error(error);
    say("Could not load registrations. Check Firestore Rules.");
  }
};

loadTournament();
