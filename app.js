/* ═══════════════════════════════════════════════════════════
   JOLENE'S DRAMA LIST — app.js
   ═══════════════════════════════════════════════════════════ */

// ── CONFIG — FILL THESE IN ───────────────────────────────────
const TMDB_API_KEY   = "ba8ddf8e7b60437308efe36024b1c3d6";
const ADMIN_PASSWORD = "210326";

const firebaseConfig = {
  apiKey: "AIzaSyBf9paX6A8wndbNXQeYop8pkfKC_vFMeOk",
  authDomain: "drama-list-810d4.firebaseapp.com",
  databaseURL: "https://drama-list-810d4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "drama-list-810d4",
  storageBucket: "drama-list-810d4.firebasestorage.app",
  messagingSenderId: "198560796882",
  appId: "1:198560796882:web:77b4190e79803320c3dd0b"
};
// ────────────────────────────────────────────────────────────

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);
const dramasRef   = ref(db, "dramas");

let dramas = {}, isAdmin = false, currentSort = "added";
let filterStatus = "", filterCountry = "";
let noteClicks = 0;

// ── Firebase listener ────────────────────────────────────────
onValue(dramasRef, (snapshot) => {
  const prev = Object.keys(dramas).length;
  dramas = snapshot.val() || {};
  const curr = Object.keys(dramas).length;
  if (curr > prev && prev > 0) checkMilestone(curr);
  render();
});

// ── Dark mode ────────────────────────────────────────────────
function toggleDark() {
  document.body.classList.toggle("dark");
  const on = document.body.classList.contains("dark");
  document.getElementById("darkBtn").textContent = on ? "☀️" : "🌙";
  localStorage.setItem("dark", on);
}
if (localStorage.getItem("dark") === "true") {
  document.body.classList.add("dark");
  document.getElementById("darkBtn").textContent = "☀️";
}

// ── Birthday note ────────────────────────────────────────────
function revealNote() {
  noteClicks++;
  if (noteClicks >= 3) {
    document.getElementById("noteBg").classList.add("open");
    noteClicks = 0;
  } else {
    showToast("✿ click " + (3 - noteClicks) + " more times...");
  }
}
function closeNote() { document.getElementById("noteBg").classList.remove("open"); }

// ── Password modal ────────────────────────────────────────────
function openPasswordModal() {
  if (isAdmin) { setAdmin(false); return; }
  document.getElementById("modalBg").classList.add("open");
  document.getElementById("pwInput").value = "";
  document.getElementById("pwErr").textContent = "";
  setTimeout(() => document.getElementById("pwInput").focus(), 120);
}
function closePasswordModal() { document.getElementById("modalBg").classList.remove("open"); }
function checkPassword() {
  if (document.getElementById("pwInput").value === ADMIN_PASSWORD) {
    closePasswordModal(); setAdmin(true);
  } else {
    document.getElementById("pwErr").textContent = "Wrong password — try again";
    document.getElementById("pwInput").value = "";
    document.getElementById("pwInput").focus();
  }
}
function setAdmin(v) {
  isAdmin = v;
  const btn = document.getElementById("adminToggle");
  const panel = document.getElementById("addPanel");
  document.querySelector(".page-wrap").classList.toggle("admin-mode", v);
  if (v) { btn.textContent = "🔓 done editing"; btn.classList.add("active"); panel.classList.add("open"); document.getElementById("titleInput").focus(); }
  else   { btn.textContent = "🔒 manage list";  btn.classList.remove("active"); panel.classList.remove("open"); }
  render();
}

// ── Country / genre helpers ───────────────────────────────────
function mapCountry(codes) {
  if (!codes || !codes.length) return "Other";
  const m = { KR:"Korean", CN:"Chinese", JP:"Japanese", TH:"Thai", TW:"Taiwanese", HK:"Chinese" };
  return m[codes[0]] || "Other";
}
function mapGenres(ids) {
  const m = {10759:"Action",16:"Animation",35:"Comedy",80:"Crime",99:"Documentary",18:"Drama",10751:"Family",10762:"Kids",9648:"Mystery",10763:"News",10764:"Reality",10765:"Sci-Fi",10766:"Soap",10767:"Talk",10768:"War",37:"Western",10749:"Romance",27:"Horror",53:"Thriller",14:"Fantasy",36:"History",10402:"Music"};
  return (ids||[]).slice(0,3).map(id=>m[id]).filter(Boolean);
}

// ── TMDB fetch ────────────────────────────────────────────────
async function fetchTMDB(title) {
  if (!TMDB_API_KEY || TMDB_API_KEY === "PASTE_YOUR_TMDB_KEY_HERE")
    return { poster:"", year: new Date().getFullYear(), country:"Korean", genres:[] };
  try {
    const res  = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=en-US`);
    const data = await res.json();
    const results = (data.results||[]).filter(r=>r.poster_path);
    if (!results.length) return { poster:"", year: new Date().getFullYear(), country:"Korean", genres:[] };
    const best   = results.find(r=>r.media_type==="tv") || results[0];
    const poster = `https://image.tmdb.org/t/p/w300${best.poster_path}`;
    const dateStr= best.first_air_date || best.release_date || "";
    const year   = dateStr ? parseInt(dateStr.slice(0,4)) : new Date().getFullYear();
    const country= mapCountry(best.origin_country);
    const genres = mapGenres(best.genre_ids);
    return { poster, year, country, genres };
  } catch(e) { return { poster:"", year: new Date().getFullYear(), country:"Korean", genres:[] }; }
}

// ── Add single drama ──────────────────────────────────────────
async function addDrama() {
  const title = document.getElementById("titleInput").value.trim();
  if (!title) { showToast("✦ Please enter a drama title"); return; }
  const btn = document.getElementById("addBtn");
  btn.disabled = true; btn.textContent = "Fetching info...";
  const tmdb = await fetchTMDB(title);
  const manualYear    = parseInt(document.getElementById("yearInput").value);
  const manualCountry = document.getElementById("countryInput").value;
  const id = "d_" + Date.now();
  const drama = { id, title, year: manualYear||tmdb.year, country: manualCountry||tmdb.country, genres: tmdb.genres, fav:false, addedAt:Date.now(), poster:tmdb.poster, status:"", rating:0, episodes:"", totalEpisodes:"", rewatches:0, notes:"", ost:"" };
  await set(ref(db, `dramas/${id}`), drama);
  document.getElementById("titleInput").value = "";
  document.getElementById("yearInput").value = "";
  document.getElementById("countryInput").value = "";
  showToast("✓ Added: " + title + (tmdb.poster?" 🖼":""));
  btn.disabled = false; btn.textContent = "+ Add";
}

// ── Bulk add ──────────────────────────────────────────────────
async function bulkAdd() {
  const raw = document.getElementById("bulkInput").value.trim();
  if (!raw) { showToast("✦ Paste some drama titles first"); return; }
  const lines = [...new Set(raw.split("\n").map(l=>l.trim()).filter(l=>l.length>0))];
  const existingTitles = Object.values(dramas).map(d=>d.title.toLowerCase());
  const toAdd = lines.filter(l=>!existingTitles.includes(l.toLowerCase()));
  const skipped = lines.length - toAdd.length;
  if (!toAdd.length) { showToast("All dramas already in the list!"); return; }
  const btn = document.getElementById("bulkBtn");
  const progress = document.getElementById("bulkProgress");
  btn.disabled = true;
  progress.innerHTML = `<div>Adding <strong>${toAdd.length}</strong> dramas${skipped?` (${skipped} skipped)`:""}... 🌸</div><div class="prog-bar-wrap"><div class="prog-bar" id="progBar" style="width:0%"></div></div>`;
  let done = 0;
  for (const title of toAdd) {
    const tmdb = await fetchTMDB(title);
    const id = "d_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    await set(ref(db, `dramas/${id}`), { id, title, year:tmdb.year, country:tmdb.country, genres:tmdb.genres, fav:false, addedAt:Date.now()-(toAdd.length-done)*10, poster:tmdb.poster, status:"", rating:0, episodes:"", totalEpisodes:"", rewatches:0, notes:"", ost:"" });
    done++;
    document.getElementById("progBar").style.width = Math.round(done/toAdd.length*100)+"%";
    progress.querySelector("div").textContent = `Added ${done} of ${toAdd.length}${skipped?` (${skipped} skipped)`:""}... 🌸`;
    await new Promise(r=>setTimeout(r,300));
  }
  progress.innerHTML = `✓ Done! Added <strong>${done}</strong> dramas${skipped?`, skipped ${skipped} duplicates`:""} 🎉`;
  document.getElementById("bulkInput").value = "";
  btn.disabled = false;
  showToast(`✓ Imported ${done} dramas!`);
}

// ── Detail modal ──────────────────────────────────────────────
function openDetail(id) {
  const d = dramas[id];
  if (!d) return;
  const genreHTML = (d.genres||[]).map(g=>`<span class="detail-genre">${g}</span>`).join("");
  const posterHTML = d.poster
    ? `<img src="${d.poster}" style="width:100%;border-radius:10px" onerror="this.style.display='none'">`
    : `<div class="detail-poster-ph">${countryEmoji(d.country)}</div>`;
  const ratingHTML = [1,2,3,4,5].map(i=>`<span class="detail-star" onclick="setRating('${id}',${i})" id="star_${id}_${i}">${i<=(d.rating||0)?"★":"☆"}</span>`).join("");
  document.getElementById("detailContent").innerHTML = `
    <div class="detail-top">
      <div class="detail-poster">${posterHTML}</div>
      <div class="detail-info">
        <div class="detail-title">${escHtml(d.title)}</div>
        <div class="detail-sub">${d.year}${d.country?" · "+d.country:""}</div>
        <div class="detail-genres">${genreHTML}</div>
        <div class="detail-label">Rating</div>
        <div class="detail-stars">${ratingHTML}</div>
      </div>
    </div>
    <div class="detail-row">
      <div class="detail-field">
        <div class="detail-label">Status</div>
        <select class="detail-select" id="det_status" onchange="saveField('${id}','status',this.value)">
          <option value="" ${!d.status?"selected":""}>— Not set —</option>
          <option value="Completed" ${d.status==="Completed"?"selected":""}>✅ Completed</option>
          <option value="Watching"  ${d.status==="Watching" ?"selected":""}>▶️ Watching</option>
          <option value="Plan to Watch" ${d.status==="Plan to Watch"?"selected":""}>📌 Plan to Watch</option>
          <option value="Dropped"   ${d.status==="Dropped"  ?"selected":""}>❌ Dropped</option>
        </select>
      </div>
      <div class="detail-field">
        <div class="detail-label">Episodes</div>
        <div style="display:flex;gap:6px;align-items:center">
          <input class="detail-input" style="width:60px" type="number" id="det_ep" value="${d.episodes||""}" placeholder="0" min="0" onchange="saveField('${id}','episodes',this.value)">
          <span style="color:var(--muted);font-size:13px">/</span>
          <input class="detail-input" style="width:60px" type="number" id="det_tep" value="${d.totalEpisodes||""}" placeholder="?" min="0" onchange="saveField('${id}','totalEpisodes',this.value)">
        </div>
      </div>
      <div class="detail-field">
        <div class="detail-label">Rewatches</div>
        <div style="display:flex;gap:6px;align-items:center">
          <button onclick="changeRewatch('${id}',-1)" style="background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;color:var(--text)">−</button>
          <span id="rewatch_${id}" style="font-size:16px;font-weight:500;min-width:20px;text-align:center">${d.rewatches||0}</span>
          <button onclick="changeRewatch('${id}',1)" style="background:var(--surface2);border:1.5px solid var(--border);border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:16px;color:var(--text)">+</button>
        </div>
      </div>
    </div>
    <div class="detail-field" style="margin-bottom:14px">
      <div class="detail-label">Personal notes</div>
      <textarea class="detail-textarea" id="det_notes" placeholder="Your thoughts on this drama...">${escHtml(d.notes||"")}</textarea>
    </div>
    <div class="detail-field detail-ost">
      <div class="detail-label">OST (YouTube link)</div>
      <div class="ost-input-row">
        <input class="detail-input" id="det_ost" type="url" placeholder="Paste YouTube URL..." value="${escHtml(d.ost||"")}">
        <button class="play-ost-btn" onclick="playOST('${id}')">▶ Play</button>
      </div>
    </div>
    <button class="detail-save" onclick="saveDetail('${id}')">Save changes ✦</button>`;
  document.getElementById("detailBg").classList.add("open");
}

function closeDetail() { document.getElementById("detailBg").classList.remove("open"); }

async function saveField(id, field, value) {
  await set(ref(db, `dramas/${id}/${field}`), value);
}

async function setRating(id, val) {
  const current = dramas[id]?.rating || 0;
  const newRating = current === val ? 0 : val;
  await set(ref(db, `dramas/${id}/rating`), newRating);
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`star_${id}_${i}`);
    if (el) el.textContent = i <= newRating ? "★" : "☆";
  }
}

async function changeRewatch(id, delta) {
  const current = dramas[id]?.rewatches || 0;
  const newVal = Math.max(0, current + delta);
  await set(ref(db, `dramas/${id}/rewatches`), newVal);
  const el = document.getElementById(`rewatch_${id}`);
  if (el) el.textContent = newVal;
}

async function saveDetail(id) {
  const notes = document.getElementById("det_notes")?.value || "";
  const ost   = document.getElementById("det_ost")?.value || "";
  const ep    = document.getElementById("det_ep")?.value || "";
  const tep   = document.getElementById("det_tep")?.value || "";
  await set(ref(db, `dramas/${id}/notes`), notes);
  await set(ref(db, `dramas/${id}/ost`), ost);
  await set(ref(db, `dramas/${id}/episodes`), ep);
  await set(ref(db, `dramas/${id}/totalEpisodes`), tep);
  showToast("✓ Saved!");
  closeDetail();
}

// ── OST Player ────────────────────────────────────────────────
function playOST(id) {
  const ost = document.getElementById("det_ost")?.value || dramas[id]?.ost || "";
  if (!ost) { showToast("✦ Paste a YouTube URL first"); return; }
  const ytId = extractYTId(ost);
  if (!ytId) { showToast("✦ Couldn't read that YouTube URL"); return; }
  const player = document.getElementById("ostPlayer");
  document.getElementById("ostTitle").textContent = "🎵 " + (dramas[id]?.title || "OST");
  document.getElementById("ostFrame").innerHTML = `<iframe width="100%" height="200" src="https://www.youtube.com/embed/${ytId}?autoplay=1" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen></iframe>`;
  player.style.display = "block";
  closeDetail();
}
function closeOST() {
  document.getElementById("ostPlayer").style.display = "none";
  document.getElementById("ostFrame").innerHTML = "";
}
function extractYTId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Random pick ───────────────────────────────────────────────
function randomPick() {
  const planList = Object.values(dramas).filter(d=>d.status==="Plan to Watch");
  const pool = planList.length ? planList : Object.values(dramas);
  if (!pool.length) { showToast("Add some dramas first!"); return; }
  const d = pool[Math.floor(Math.random()*pool.length)];
  document.getElementById("randomContent").innerHTML = `
    ${d.poster?`<img src="${d.poster}" style="width:120px;border-radius:12px;margin-bottom:12px">`:""}
    <p style="font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:600">${escHtml(d.title)}</p>
    <p style="font-size:13px;color:var(--muted);margin-top:4px">${d.year}${d.country?" · "+d.country:""}</p>
    ${planList.length?`<p style="font-size:12px;color:var(--accent);margin-top:8px">from your Plan to Watch list ✦</p>`:""}`;
  document.getElementById("randomBg").classList.add("open");
}
function closeRandom() { document.getElementById("randomBg").classList.remove("open"); }

// ── Favourites & Delete ───────────────────────────────────────
async function toggleFav(id, e) {
  e.stopPropagation();
  const d = dramas[id]; if (!d) return;
  await set(ref(db, `dramas/${id}/fav`), !d.fav);
}
async function deleteDrama(id, e) {
  e.stopPropagation();
  if (!confirm("Remove this drama?")) return;
  await remove(ref(db, `dramas/${id}`));
  showToast("Drama removed");
}

// ── Sort & filter ─────────────────────────────────────────────
function setSort(s) {
  currentSort = s;
  document.querySelectorAll(".filter-btn[data-sort]").forEach(b => {
    b.classList.toggle("active", b.dataset.sort === s);
  });
  render();
}

// ── Render ────────────────────────────────────────────────────
function setStatusFilter(val) {
  filterStatus = filterStatus === val ? "" : val;
  // update button styles
  document.querySelectorAll(".status-filter-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.val === filterStatus);
  });
  render();
}

function setCountryFilter(val) {
  filterCountry = filterCountry === val ? "" : val;
  document.querySelectorAll(".country-filter-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.val === filterCountry);
  });
  render();
}

function clearFilters() {
  filterStatus = ""; filterCountry = "";
  document.getElementById("searchInput").value = "";
  document.querySelectorAll(".status-filter-btn, .country-filter-btn").forEach(b => b.classList.remove("active"));
  render();
}

function render() {
  const q = (document.getElementById("searchInput")?.value || "").toLowerCase().trim();
  let list = Object.values(dramas);

  if (q)            list = list.filter(d => d.title.toLowerCase().includes(q) || (d.country||"").toLowerCase().includes(q) || (d.genres||[]).some(g => g.toLowerCase().includes(q)));
  if (filterStatus) list = list.filter(d => (d.status||"") === filterStatus);
  if (filterCountry)list = list.filter(d => (d.country||"") === filterCountry);

  switch(currentSort) {
    case "alpha":  list.sort((a,b)=>a.title.localeCompare(b.title)); break;
    case "year":   list.sort((a,b)=>b.year-a.year); break;
    case "fav":    list.sort((a,b)=>(b.fav?1:0)-(a.fav?1:0)); break;
    case "rating": list.sort((a,b)=>(b.rating||0)-(a.rating||0)); break;
    default:       list.sort((a,b)=>b.addedAt-a.addedAt);
  }

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  if (!list.length) {
    const hasFilter = q || filterStatus || filterCountry;
    grid.innerHTML = `<div class="empty-state"><div class="es-emoji">🎭</div><p>${hasFilter ? "No dramas found" : "No dramas yet"}</p><span>${hasFilter ? "Try a different filter" : "Add your first drama above!"}</span>${hasFilter ? `<br><button onclick="clearFilters()" style="margin-top:14px;background:var(--accent);color:#fff;border:none;border-radius:50px;padding:9px 22px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer">Clear filters</button>` : ""}</div>`;
  } else {
    list.forEach((d,i)=>{
      const card = document.createElement("div");
      card.className = "drama-card";
      card.style.animationDelay = (i*0.03)+"s";
      card.onclick = () => openDetail(d.id);
      const posterHTML = d.poster?`<img class="drama-poster" src="${d.poster}" alt="${escHtml(d.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` :"";
      const phStyle = d.poster?"display:none":"";
      const starsHTML = [1,2,3,4,5].map(i=>`<span class="star">${i<=(d.rating||0)?"★":"☆"}</span>`).join("");
      const statusLabel = d.status || "";
      const statusClassMap = {"Completed":"Completed","Watching":"Watching","Plan to Watch":"PlantoWatch","Dropped":"Dropped"};
      const statusClass = d.status ? `status-${statusClassMap[d.status]||d.status.replace(/\s+/g,"")}` : "";
      const genreTags = (d.genres||[]).slice(0,2).map(g=>`<span class="genre-tag">${g}</span>`).join("");
      card.innerHTML = `
        ${posterHTML}
        <div class="poster-placeholder" style="${phStyle}">
          <span class="ph-emoji">${countryEmoji(d.country)}</span>
          <p class="ph-title">${escHtml(d.title)}</p>
        </div>
        ${d.fav?`<div class="fav-badge">★</div>`:""}
        <button class="delete-btn" onclick="deleteDrama('${d.id}',event)">✕</button>
        <div class="drama-info">
          <div class="drama-title">${escHtml(d.title)}</div>
          <div class="genre-tags">${genreTags}</div>
          ${d.status?`<div class="status-badge"><span class="status-tag ${statusClass}">${statusLabel}</span></div>`:""}
          <div class="drama-meta">
            <span class="drama-year">${d.year}${d.country?" · "+d.country:""}</span>
            <button class="fav-btn" onclick="toggleFav('${d.id}',event)">${d.fav?"★":"☆"}</button>
          </div>
          <div class="stars-row">${starsHTML}</div>
        </div>`;
      grid.appendChild(card);
    });
  }

  const all   = Object.values(dramas);
  const favs  = all.filter(d=>d.fav).length;
  const watching = all.filter(d=>d.status==="Watching").length;
  const planned  = all.filter(d=>d.status==="Plan to Watch").length;
  document.getElementById("statsRow").innerHTML = `
    <div class="stat-card"><div class="stat-num">${all.length}</div><div class="stat-label">Total</div></div>
    <div class="stat-card"><div class="stat-num">${favs}</div><div class="stat-label">Favourites</div></div>
    <div class="stat-card"><div class="stat-num">${watching}</div><div class="stat-label">Watching</div></div>
    <div class="stat-card"><div class="stat-num">${planned}</div><div class="stat-label">Plan to Watch</div></div>`;
}

// ── Milestone confetti ────────────────────────────────────────
function checkMilestone(count) {
  if ([10,50,100,200].includes(count)) {
    showToast(`🎉 ${count} dramas! Amazing!`);
    launchConfetti();
  }
}
function launchConfetti() {
  const canvas = document.getElementById("confetti");
  const ctx = canvas.getContext("2d");
  canvas.style.display = "block";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const pieces = Array.from({length:120},()=>({
    x: Math.random()*canvas.width, y: -10,
    r: 4+Math.random()*6, d: 2+Math.random()*3,
    color: ["#c9624a","#e8a87c","#f0d4a8","#f7e8e4","#a8d8c8"][Math.floor(Math.random()*5)],
    tilt: Math.random()*10-5, tiltAngle: 0
  }));
  let frame = 0;
  const anim = setInterval(()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    pieces.forEach(p=>{
      p.tiltAngle += 0.05; p.y += p.d; p.tilt = Math.sin(p.tiltAngle)*12;
      ctx.beginPath(); ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x+p.tilt+p.r/2, p.y);
      ctx.lineTo(p.x+p.tilt, p.y+p.tilt+p.r/2);
      ctx.stroke();
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random()*canvas.width; }
    });
    if (++frame > 180) { clearInterval(anim); ctx.clearRect(0,0,canvas.width,canvas.height); canvas.style.display="none"; }
  }, 16);
}

// ── Helpers ───────────────────────────────────────────────────
function countryEmoji(c) {
  const m = {Korean:"🇰🇷",Chinese:"🇨🇳",Japanese:"🇯🇵",Thai:"🇹🇭",Taiwanese:"🇹🇼"};
  return m[c]||"🎭";
}
function escHtml(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2600);
}
function spawnPetals() {
  const c = document.getElementById("petals");
  ["🌸","🌺","✿","❀","🌷"].forEach(s=>{
    for(let i=0;i<3;i++){
      const el = document.createElement("span");
      el.className = "petal"; el.textContent = s;
      el.style.left = Math.random()*100+"%";
      el.style.fontSize = (11+Math.random()*12)+"px";
      el.style.animationDuration = (3.5+Math.random()*5)+"s";
      el.style.animationDelay = (Math.random()*6)+"s";
      c.appendChild(el);
    }
  });
}

// ── Actor Cards ───────────────────────────────────────────────
const ACTOR_SLOTS = [
  { key: "fav",       crown: "🌟", role: "Favourite Actor"  },
  { key: "handsome",  crown: "👑", role: "Most Handsome"    },
  { key: "beautiful", crown: "🌸", role: "Most Beautiful"   }
];

function renderActors() {
  const section = document.getElementById("actorsSection");
  if (!section) return;
  section.innerHTML = ACTOR_SLOTS.map(slot => {
    const a = actorData[slot.key] || {};
    const photoHTML = a.photo
      ? `<img src="${escHtml(a.photo)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : "";
    const phStyle = a.photo ? "display:none" : "";
    return `
      <div class="actor-card">
        <div class="actor-photo-wrap">
          ${photoHTML}
          <div class="actor-photo-placeholder" style="${phStyle}">${slot.crown}</div>
          <button class="actor-edit-btn" onclick="openActorModal('${slot.key}')">✎</button>
        </div>
        <div class="actor-body">
          <div class="actor-crown">${slot.crown}</div>
          <div class="actor-role">${slot.role}</div>
          <div class="actor-name">${escHtml(a.name || "Add actor")}</div>
          ${a.note ? `<div class="actor-note">${escHtml(a.note)}</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

let actorData = {};

// load from firebase
const actorsRef = ref(db, "actors");
onValue(actorsRef, (snapshot) => {
  actorData = snapshot.val() || {};
  renderActors();
});

let currentActorSlot = "";

function openActorModal(key) {
  if (!isAdmin) return;
  currentActorSlot = key;
  const slot = ACTOR_SLOTS.find(s => s.key === key);
  const a = actorData[key] || {};
  document.getElementById("actorModalTitle").textContent = slot.crown + " " + slot.role;
  document.getElementById("actorNameInput").value  = a.name  || "";
  document.getElementById("actorPhotoInput").value = a.photo || "";
  document.getElementById("actorNoteInput").value  = a.note  || "";
  updateActorPreview();
  document.getElementById("actorBg").classList.add("open");
}

function closeActorModal() {
  document.getElementById("actorBg").classList.remove("open");
}

function updateActorPreview() {
  const url = document.getElementById("actorPhotoInput").value.trim();
  const preview = document.getElementById("actorPreviewImg");
  const ph      = document.getElementById("actorPreviewPh");
  if (url) {
    preview.src = url;
    preview.style.display = "block";
    ph.style.display = "none";
  } else {
    preview.style.display = "none";
    ph.style.display = "flex";
  }
}

async function saveActor() {
  const name  = document.getElementById("actorNameInput").value.trim();
  const photo = document.getElementById("actorPhotoInput").value.trim();
  const note  = document.getElementById("actorNoteInput").value.trim();
  await set(ref(db, `actors/${currentActorSlot}`), { name, photo, note });
  closeActorModal();
  showToast("✓ Saved!");
}

// ── Event listeners ───────────────────────────────────────────
document.getElementById("modalBg").addEventListener("click",function(e){if(e.target===this)closePasswordModal()});
document.getElementById("detailBg").addEventListener("click",function(e){if(e.target===this)closeDetail()});
document.getElementById("randomBg").addEventListener("click",function(e){if(e.target===this)closeRandom()});
document.getElementById("noteBg").addEventListener("click",function(e){if(e.target===this)closeNote()});

// search — wired directly so it always works inside a module
document.getElementById("searchInput").addEventListener("input", render);

// sort buttons
document.querySelectorAll(".filter-btn[data-sort]").forEach(btn => {
  btn.addEventListener("click", () => setSort(btn.dataset.sort, btn));
});

document.getElementById("actorBg").addEventListener("click",function(e){if(e.target===this)closeActorModal()});

// ── Expose to HTML ────────────────────────────────────────────
window.openPasswordModal=openPasswordModal; window.closePasswordModal=closePasswordModal;
window.checkPassword=checkPassword; window.addDrama=addDrama; window.bulkAdd=bulkAdd;
window.toggleFav=toggleFav; window.deleteDrama=deleteDrama; window.setSort=setSort;
window.openDetail=openDetail; window.closeDetail=closeDetail; window.saveDetail=saveDetail;
window.saveField=saveField; window.setRating=setRating; window.changeRewatch=changeRewatch;
window.playOST=playOST; window.closeOST=closeOST; window.randomPick=randomPick;
window.closeRandom=closeRandom; window.toggleDark=toggleDark; window.revealNote=revealNote;
window.closeNote=closeNote; window.setStatusFilter=setStatusFilter;
window.setCountryFilter=setCountryFilter; window.clearFilters=clearFilters;
window.render=render; window.openActorModal=openActorModal;
window.closeActorModal=closeActorModal; window.saveActor=saveActor;
window.updateActorPreview=updateActorPreview;

spawnPetals();