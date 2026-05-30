/* ═══════════════════════════════════════════════════════════════
   HER DRAMA LIST — app.js
   ─────────────────────────────────────────────────────────────
   SETUP REQUIRED (see README.md):
     1. Replace TMDB_API_KEY  with your key from themoviedb.org
     2. Replace the firebaseConfig object with your Firebase config
   ═══════════════════════════════════════════════════════════════ */

// ── CONFIG ── FILL THESE IN ──────────────────────────────────
const TMDB_API_KEY    = "ba8ddf8e7b60437308efe36024b1c3d6";
const ADMIN_PASSWORD  = "jolene";   // Change this to whatever you want!

const firebaseConfig = {
  apiKey: "AIzaSyD5k6pwAwZ89dfoUfcUhwD22tcuHkR2A_A",
  authDomain: "drama-list-e4b7a.firebaseapp.com",
  databaseURL: "https://drama-list-e4b7a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "drama-list-e4b7a",
  storageBucket: "drama-list-e4b7a.firebasestorage.app",
  messagingSenderId: "60250688988",
  appId: "1:60250688988:web:51c318c98d4f1ce534d319"
};
// ─────────────────────────────────────────────────────────────

// ── Firebase SDK (loaded from CDN) ───────────────────────────
import { initializeApp }                    from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);
const dramasRef   = ref(db, "dramas");

// ── App State ─────────────────────────────────────────────────
let dramas      = {};    // { id: dramaObject }
let isAdmin     = false;
let currentSort = "added";

// ── Boot: listen for realtime changes from Firebase ──────────
onValue(dramasRef, (snapshot) => {
  dramas = snapshot.val() || {};
  render();
});

// ── Password Modal ────────────────────────────────────────────
function openPasswordModal() {
  if (isAdmin) { setAdmin(false); return; }
  document.getElementById("modalBg").classList.add("open");
  document.getElementById("pwInput").value = "";
  document.getElementById("pwErr").textContent = "";
  setTimeout(() => document.getElementById("pwInput").focus(), 120);
}

function closePasswordModal() {
  document.getElementById("modalBg").classList.remove("open");
}

function checkPassword() {
  const pw = document.getElementById("pwInput").value;
  if (pw === ADMIN_PASSWORD) {
    closePasswordModal();
    setAdmin(true);
  } else {
    document.getElementById("pwErr").textContent = "Wrong password — try again";
    document.getElementById("pwInput").value = "";
    document.getElementById("pwInput").focus();
  }
}

function setAdmin(v) {
  isAdmin = v;
  const btn   = document.getElementById("adminToggle");
  const panel = document.getElementById("addPanel");
  document.querySelector(".page-wrap").classList.toggle("admin-mode", v);

  if (v) {
    btn.textContent = "🔓 done editing";
    btn.classList.add("active");
    panel.classList.add("open");
    document.getElementById("titleInput").focus();
  } else {
    btn.textContent = "🔒 manage list";
    btn.classList.remove("active");
    panel.classList.remove("open");
  }
  render();
}

// ── Country code → readable name ─────────────────────────────
function mapCountry(originCountries) {
  if (!originCountries || !originCountries.length) return "Other";
  const code = originCountries[0];
  const map  = {
    KR: "Korean", CN: "Chinese", JP: "Japanese",
    TH: "Thai",   TW: "Taiwanese", HK: "Chinese",
    US: "Other",  GB: "Other"
  };
  return map[code] || "Other";
}

// ── TMDB fetch — returns { poster, year, country } ───────────
async function fetchTMDB(title) {
  if (!TMDB_API_KEY || TMDB_API_KEY === "PASTE_YOUR_TMDB_KEY_HERE") {
    return { poster: "", year: new Date().getFullYear(), country: "Korean" };
  }
  try {
    const query = encodeURIComponent(title);
    const url   = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${query}&language=en-US`;
    const res   = await fetch(url);
    const data  = await res.json();

    // prefer TV shows with a poster
    const results = (data.results || []).filter(r => r.poster_path);
    if (!results.length) return { poster: "", year: new Date().getFullYear(), country: "Korean" };

    const best    = results.find(r => r.media_type === "tv") || results[0];
    const poster  = `https://image.tmdb.org/t/p/w300${best.poster_path}`;
    const dateStr = best.first_air_date || best.release_date || "";
    const year    = dateStr ? parseInt(dateStr.slice(0, 4)) : new Date().getFullYear();
    const country = mapCountry(best.origin_country);

    return { poster, year, country };
  } catch (e) {
    console.warn("TMDB fetch failed:", e);
    return { poster: "", year: new Date().getFullYear(), country: "Korean" };
  }
}

// ── Add Drama ─────────────────────────────────────────────────
async function addDrama() {
  const title          = document.getElementById("titleInput").value.trim();
  const manualYear     = parseInt(document.getElementById("yearInput").value);
  const manualCountry  = document.getElementById("countryInput").value;

  if (!title) { showToast("✦ Please enter a drama title"); return; }

  const btn = document.getElementById("addBtn");
  btn.disabled    = true;
  btn.textContent = "Fetching info...";

  // auto-fetch poster, year, country from TMDB
  const tmdb    = await fetchTMDB(title);
  const poster  = tmdb.poster;
  const year    = manualYear  || tmdb.year;
  const country = manualCountry || tmdb.country;

  const id    = "d_" + Date.now();
  const drama = { id, title, year, country, fav: false, addedAt: Date.now(), poster };

  // save to Firebase — syncs to ALL devices instantly
  await set(ref(db, `dramas/${id}`), drama);

  // clear inputs
  document.getElementById("titleInput").value  = "";
  document.getElementById("yearInput").value   = "";
  document.getElementById("countryInput").value = "";

  showToast("✓ Added: " + title + (poster ? " 🖼" : ""));
  btn.disabled    = false;
  btn.textContent = "+ Add";
}

// ── Toggle Favourite ──────────────────────────────────────────
async function toggleFav(id, e) {
  e.stopPropagation();
  const drama = dramas[id];
  if (!drama) return;
  await set(ref(db, `dramas/${id}/fav`), !drama.fav);
}

// ── Delete Drama ──────────────────────────────────────────────
async function deleteDrama(id, e) {
  e.stopPropagation();
  if (!confirm("Remove this drama from the list?")) return;
  await remove(ref(db, `dramas/${id}`));
  showToast("Drama removed");
}

// ── Sort ──────────────────────────────────────────────────────
function setSort(s, btn) {
  currentSort = s;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  render();
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const q    = document.getElementById("searchInput").value.toLowerCase();
  let list   = Object.values(dramas);

  // search filter
  if (q) list = list.filter(d =>
    d.title.toLowerCase().includes(q) ||
    (d.country || "").toLowerCase().includes(q)
  );

  // sort
  switch (currentSort) {
    case "alpha":  list.sort((a, b) => a.title.localeCompare(b.title));          break;
    case "year":   list.sort((a, b) => b.year - a.year);                         break;
    case "fav":    list.sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0));      break;
    default:       list.sort((a, b) => b.addedAt - a.addedAt);                   break;  // recent
  }

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="es-emoji">🎭</div>
        <p>${q ? "No dramas found" : "No dramas yet"}</p>
        <span>${q ? "Try a different search" : "Add your first drama above!"}</span>
      </div>`;
  } else {
    list.forEach((d, i) => {
      const card = document.createElement("div");
      card.className = "drama-card";
      card.style.animationDelay = (i * 0.04) + "s";

      const posterHTML = d.poster
        ? `<img class="drama-poster" src="${d.poster}" alt="${escHtml(d.title)}"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : "";

      const placeholderVisible = d.poster ? "display:none" : "";

      card.innerHTML = `
        ${posterHTML}
        <div class="poster-placeholder" style="${placeholderVisible}">
          <span class="ph-emoji">${countryEmoji(d.country)}</span>
          <p class="ph-title">${escHtml(d.title)}</p>
        </div>
        ${d.fav ? `<div class="fav-badge">★</div>` : ""}
        <button class="delete-btn" onclick="deleteDrama('${d.id}', event)" title="Remove">✕</button>
        <div class="drama-info">
          <div class="drama-title">${escHtml(d.title)}</div>
          <div class="drama-meta">
            <span class="drama-year">${d.year}${d.country ? " · " + d.country : ""}</span>
            <button class="fav-btn" onclick="toggleFav('${d.id}', event)" title="${d.fav ? "Unfavourite" : "Favourite"}">
              ${d.fav ? "★" : "☆"}
            </button>
          </div>
        </div>`;

      grid.appendChild(card);
    });
  }

  // stats
  const all   = Object.values(dramas);
  const favs  = all.filter(d => d.fav).length;
  const ctrs  = new Set(all.map(d => d.country).filter(Boolean)).size;
  const new24 = all.filter(d => d.year >= 2024).length;

  document.getElementById("statsRow").innerHTML = `
    <div class="stat-card"><div class="stat-num">${all.length}</div><div class="stat-label">Total dramas</div></div>
    <div class="stat-card"><div class="stat-num">${favs}</div><div class="stat-label">Favourites</div></div>
    <div class="stat-card"><div class="stat-num">${ctrs}</div><div class="stat-label">Countries</div></div>
    <div class="stat-card"><div class="stat-num">${new24}</div><div class="stat-label">2024+</div></div>`;
}

// ── Helpers ───────────────────────────────────────────────────
function countryEmoji(c) {
  const map = { Korean: "🇰🇷", Chinese: "🇨🇳", Japanese: "🇯🇵", Thai: "🇹🇭", Taiwanese: "🇹🇼" };
  return map[c] || "🎭";
}

function escHtml(s) {
  return (s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}

// ── Falling petals ────────────────────────────────────────────
function spawnPetals() {
  const container = document.getElementById("petals");
  const symbols   = ["🌸", "🌺", "✿", "❀", "🌷"];
  for (let i = 0; i < 14; i++) {
    const el = document.createElement("span");
    el.className     = "petal";
    el.textContent   = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left              = Math.random() * 100 + "%";
    el.style.fontSize          = (11 + Math.random() * 12) + "px";
    el.style.animationDuration = (3.5 + Math.random() * 5) + "s";
    el.style.animationDelay    = (Math.random() * 6) + "s";
    container.appendChild(el);
  }
}

// ── Bulk Add ──────────────────────────────────────────────────
async function bulkAdd() {
  const raw   = document.getElementById("bulkInput").value.trim();
  if (!raw) { showToast("✦ Paste some drama titles first"); return; }

  // split by newline, clean up empty lines and duplicates
  const lines = [...new Set(
    raw.split("\n")
       .map(l => l.trim())
       .filter(l => l.length > 0)
  )];

  if (!lines.length) { showToast("✦ No titles found"); return; }

  // check for duplicates already in the list
  const existingTitles = Object.values(dramas).map(d => d.title.toLowerCase());
  const toAdd = lines.filter(l => !existingTitles.includes(l.toLowerCase()));
  const skipped = lines.length - toAdd.length;

  if (!toAdd.length) {
    showToast("All dramas already in the list!");
    return;
  }

  const btn      = document.getElementById("bulkBtn");
  const progress = document.getElementById("bulkProgress");
  btn.disabled   = true;

  progress.innerHTML = `
    <div>Adding <strong>${toAdd.length}</strong> dramas${skipped ? ` (${skipped} already exist, skipping)` : ""}... please wait 🌸</div>
    <div class="prog-bar-wrap"><div class="prog-bar" id="progBar" style="width:0%"></div></div>`;

  let done = 0;

  for (const title of toAdd) {
    // fetch poster + year + country from TMDB
    let poster  = "";
    let year    = new Date().getFullYear();
    let country = "Other";

    if (TMDB_API_KEY && TMDB_API_KEY !== "PASTE_YOUR_TMDB_KEY_HERE") {
      try {
        const tmdb = await fetchTMDB(title);
        poster  = tmdb.poster;
        year    = tmdb.year;
        country = tmdb.country;
      } catch (e) { /* silently skip if fetch fails */ }
    }

    const id    = "d_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    const drama = { id, title, year, country: "Korean", fav: false, addedAt: Date.now() - (toAdd.length - done) * 10, poster };
    await set(ref(db, `dramas/${id}`), drama);

    done++;
    const pct = Math.round((done / toAdd.length) * 100);
    document.getElementById("progBar").style.width = pct + "%";
    progress.querySelector("div").textContent =
      `Added ${done} of ${toAdd.length}${skipped ? ` (${skipped} skipped)` : ""}... 🌸`;

    // small delay so we don't hammer the API
    await new Promise(r => setTimeout(r, 300));
  }

  progress.innerHTML = `✓ Done! Added <strong>${done}</strong> dramas${skipped ? `, skipped ${skipped} duplicates` : ""} 🎉`;
  document.getElementById("bulkInput").value = "";
  btn.disabled = false;
  showToast(`✓ Imported ${done} dramas!`);
}


document.getElementById("modalBg").addEventListener("click", function(e) {
  if (e.target === this) closePasswordModal();
});

// ── Expose functions to HTML onclick handlers ─────────────────
window.openPasswordModal  = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.checkPassword      = checkPassword;
window.addDrama           = addDrama;
window.bulkAdd            = bulkAdd;
window.toggleFav          = toggleFav;
window.deleteDrama        = deleteDrama;
window.setSort            = setSort;

// ── Init ──────────────────────────────────────────────────────
spawnPetals();
