import { CONFIG } from "./config.js";

const STORAGE_KEY = "user-study-scores-v1";
const SESSION_KEY = "user-study-session-v1";

const els = {
  loginGate: document.getElementById("loginGate"),
  loginForm: document.getElementById("loginForm"),
  loginRaterId: document.getElementById("loginRaterId"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  appRoot: document.getElementById("appRoot"),
  caseView: document.getElementById("caseView"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  jumpInput: document.getElementById("jumpInput"),
  caseTotal: document.getElementById("caseTotal"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  raterLabel: document.getElementById("raterLabel"),
  btnExport: document.getElementById("btnExport"),
  btnLogout: document.getElementById("btnLogout"),
  filterIncomplete: document.getElementById("filterIncomplete"),
  exportHint: document.getElementById("exportHint"),
};

let data = null;
let index = 0;
let scores = {};
let session = loadSession();

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession(next) {
  session = next;
  if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
  else localStorage.removeItem(SESSION_KEY);
}

function scoreKey() {
  return `${STORAGE_KEY}:${session?.raterId || "anon"}`;
}

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(scoreKey()) || "{}");
  } catch {
    return {};
  }
}

function saveScores() {
  localStorage.setItem(scoreKey(), JSON.stringify(scores));
  updateProgress();
}

function caseKey(caseId) {
  return String(caseId);
}

function isCaseComplete(caseItem) {
  const s = scores[caseKey(caseItem.id)] || {};
  for (const m of data.methods) {
    for (const c of data.criteria) {
      const v = s?.[m]?.[c.key];
      if (!(typeof v === "number" && v >= 1 && v <= 5)) return false;
    }
  }
  return true;
}

function completedCount() {
  return data.cases.filter(isCaseComplete).length;
}

function allComplete() {
  return data && completedCount() === data.cases.length;
}

function updateProgress() {
  if (!data) return;
  const done = completedCount();
  const total = data.cases.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  els.progressBar.style.backgroundSize = `${pct}% 100%`;
  els.progressText.textContent = `${done} / ${total} 已完成 (${pct}%)`;

  const ready = allComplete();
  els.btnExport.disabled = !ready;
  els.btnExport.title = ready
    ? "下载已完成的评分文件"
    : `请先完成全部样本（${done}/${total}）`;
  els.exportHint.textContent = ready
    ? "全部样本已完成。现在可以 Backup JSON，并将文件发送给组织者。"
    : `完成全部评分后才可 Backup JSON（${done}/${total}）。`;
  els.exportHint.classList.toggle("ready", ready);
}

function setScore(caseId, method, criterion, value) {
  const key = caseKey(caseId);
  if (!scores[key]) scores[key] = {};
  if (!scores[key][method]) scores[key][method] = {};
  scores[key][method][criterion] = value;
  saveScores();
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openLightbox(src) {
  let box = document.querySelector(".lightbox");
  if (!box) {
    box = document.createElement("div");
    box.className = "lightbox";
    box.innerHTML = "<img alt='preview' />";
    box.addEventListener("click", () => box.classList.remove("open"));
    document.body.appendChild(box);
  }
  box.querySelector("img").src = src;
  box.classList.add("open");
}

function renderCase() {
  if (!data) return;
  const item = data.cases[index];
  els.jumpInput.value = String(index + 1);
  els.caseTotal.textContent = `/ ${data.cases.length}`;
  els.prevBtn.disabled = index <= 0;
  els.nextBtn.disabled = index >= data.cases.length - 1;

  const s = scores[caseKey(item.id)] || {};
  const methods = ["real", ...data.methods];

  const cols = methods
    .map((m) => {
      const isReal = m === "real";
      const img = item.images[m];
      const methodDone =
        !isReal &&
        data.criteria.every((c) => typeof s?.[m]?.[c.key] === "number");

      const scoreBlock = isReal
        ? `<div class="scores"><div class="metric"><label>待编辑原图<br/><span class="en">Original image to edit（不评分）</span></label></div></div>`
        : `<div class="scores">
            ${data.criteria
              .map((c) => {
                const val = s?.[m]?.[c.key];
                const buttons = [1, 2, 3, 4, 5]
                  .map(
                    (n) =>
                      `<button type="button" data-method="${m}" data-crit="${c.key}" data-val="${n}" class="${
                        val === n ? "active" : ""
                      }">${n}</button>`
                  )
                  .join("");
                return `<div class="metric">
                  <label>${c.zh}<br/><span class="en">${c.en}</span></label>
                  <div class="stars">${buttons}</div>
                </div>`;
              })
              .join("")}
          </div>`;

      return `<article class="col ${isReal ? "real" : ""} ${methodDone ? "done" : ""}">
        <div class="col-title"><span>${isReal ? "原图 / Real Image" : m}</span></div>
        <div class="thumb"><img src="${img}" alt="${m}" loading="lazy" data-full="${img}" /></div>
        ${scoreBlock}
      </article>`;
    })
    .join("");

  els.caseView.innerHTML = `
    <div class="case-head">
      <h2>
        <span class="badge">Case ${item.id}</span>
        <span class="badge">ID ${item.image_id}</span>
        ${isCaseComplete(item) ? '<span class="badge">已完成</span>' : ""}
      </h2>
      <div class="meta">
        <div><strong>编辑指令 / Editing Instruction：</strong>${escapeHtml(
          item.instruction_zh || item.instruction_en || ""
        )}${item.instruction_zh && item.instruction_en ? ` ｜ ${escapeHtml(item.instruction_en)}` : ""}</div>
        <div><strong>原始提示 / Original Prompt：</strong>${escapeHtml(
          item.original_prompt_zh || item.original_prompt_en || ""
        )}${item.original_prompt_zh && item.original_prompt_en ? ` ｜ ${escapeHtml(item.original_prompt_en)}` : ""}</div>
        <div><strong>编辑提示 / Editing Prompt：</strong>${escapeHtml(
          item.editing_prompt_zh || item.editing_prompt_en || ""
        )}${item.editing_prompt_zh && item.editing_prompt_en ? ` ｜ ${escapeHtml(item.editing_prompt_en)}` : ""}</div>
      </div>
    </div>
    <div class="grid">${cols}</div>
  `;

  els.caseView.querySelectorAll(".stars button").forEach((btn) => {
    btn.addEventListener("click", () => {
      setScore(item.id, btn.dataset.method, btn.dataset.crit, Number(btn.dataset.val));
      renderCase();
    });
  });
  els.caseView.querySelectorAll("img[data-full]").forEach((img) => {
    img.addEventListener("click", () => openLightbox(img.dataset.full));
  });
  updateProgress();
}

function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPayload() {
  return {
    schema: 1,
    rater_id: session.raterId,
    exported_at: new Date().toISOString(),
    completed_cases: completedCount(),
    total_cases: data.cases.length,
    criteria: data.criteria.map((c) => c.key),
    methods: data.methods,
    scores,
  };
}

function show(el) {
  el.classList.remove("is-hidden");
  el.hidden = false;
  el.removeAttribute("aria-hidden");
}

function hide(el) {
  el.classList.add("is-hidden");
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
}

function enterApp() {
  scores = loadScores();
  hide(els.loginGate);
  show(els.appRoot);
  document.body.classList.add("app-mode");
  els.raterLabel.textContent = session.raterId;
  renderCase();
  window.scrollTo(0, 0);
}

function logout() {
  saveSession(null);
  location.reload();
}

els.loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  els.loginError.hidden = true;
  const raterId = els.loginRaterId.value.trim();
  const password = els.loginPassword.value;
  if (!raterId) {
    els.loginError.textContent = "Please enter Rater ID.";
    els.loginError.hidden = false;
    return;
  }
  if (password !== CONFIG.studyPassword) {
    els.loginError.textContent = "Wrong study password.";
    els.loginError.hidden = false;
    return;
  }
  saveSession({ raterId, loginAt: new Date().toISOString() });
  enterApp();
});

els.prevBtn.addEventListener("click", () => {
  if (index > 0) {
    index -= 1;
    renderCase();
  }
});
els.nextBtn.addEventListener("click", () => {
  if (index < data.cases.length - 1) {
    index += 1;
    renderCase();
  }
});
els.jumpInput.addEventListener("change", () => {
  const n = Number(els.jumpInput.value);
  if (!Number.isFinite(n)) return;
  index = Math.min(Math.max(1, Math.round(n)), data.cases.length) - 1;
  renderCase();
});
els.filterIncomplete.addEventListener("click", () => {
  const start = index + 1;
  for (let i = 0; i < data.cases.length; i++) {
    const j = (start + i) % data.cases.length;
    if (!isCaseComplete(data.cases[j])) {
      index = j;
      renderCase();
      return;
    }
  }
  alert("全部样本已完成。");
});

els.btnExport.addEventListener("click", () => {
  if (!allComplete()) {
    alert(`请先完成全部样本（${completedCount()}/${data.cases.length}）。`);
    return;
  }
  const payload = buildPayload();
  download(`user_study_${payload.rater_id}_${Date.now()}.json`, JSON.stringify(payload, null, 2));
  els.exportHint.textContent = "JSON 已下载，请将该文件发送给组织者。";
});

els.btnLogout.addEventListener("click", logout);

document.addEventListener("keydown", (e) => {
  if (els.appRoot.classList.contains("is-hidden")) return;
  if (e.target.matches("input, textarea")) return;
  if (e.key === "ArrowLeft") els.prevBtn.click();
  if (e.key === "ArrowRight") els.nextBtn.click();
});

fetch(new URL("../data/cases.json", import.meta.url))
  .then((r) => {
    if (!r.ok) throw new Error(`Failed to load cases.json (${r.status})`);
    return r.json();
  })
  .then((json) => {
    data = json;
    if (session?.raterId) enterApp();
  })
  .catch((err) => {
    els.loginError.hidden = false;
    els.loginError.textContent = err.message;
  });
