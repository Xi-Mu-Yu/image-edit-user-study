import { CONFIG } from "./config.js";
import { submitScores, isTokenConfigured, buildGitHubSubmitUrl } from "./store.js";

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
  btnSubmit: document.getElementById("btnSubmit"),
  btnExport: document.getElementById("btnExport"),
  btnLogout: document.getElementById("btnLogout"),
  filterIncomplete: document.getElementById("filterIncomplete"),
  submitStatus: document.getElementById("submitStatus"),
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

function updateProgress() {
  if (!data) return;
  const done = completedCount();
  const total = data.cases.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  els.progressBar.style.backgroundSize = `${pct}% 100%`;
  els.progressText.textContent = `${done} / ${total} completed (${pct}%)`;
  els.btnSubmit.disabled = false;
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
        ? `<div class="scores"><div class="metric"><label>Reference only / 仅作参考</label></div></div>`
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
                  <label>${c.en}<br/>${c.zh}</label>
                  <div class="stars">${buttons}</div>
                </div>`;
              })
              .join("")}
          </div>`;

      return `<article class="col ${isReal ? "real" : ""} ${methodDone ? "done" : ""}">
        <div class="col-title"><span>${isReal ? "Real Image" : m}</span></div>
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
        ${isCaseComplete(item) ? '<span class="badge">Completed</span>' : ""}
      </h2>
      <div class="meta">
        <div><strong>Editing Instruction / 编辑指令：</strong>${escapeHtml(
          item.instruction_en || ""
        )}${item.instruction_zh ? ` ｜ ${escapeHtml(item.instruction_zh)}` : ""}</div>
        <div><strong>Original Prompt：</strong>${escapeHtml(item.original_prompt_en || "")}${
          item.original_prompt_zh ? ` ｜ ${escapeHtml(item.original_prompt_zh)}` : ""
        }</div>
        <div><strong>Editing Prompt：</strong>${escapeHtml(item.editing_prompt_en || "")}${
          item.editing_prompt_zh ? ` ｜ ${escapeHtml(item.editing_prompt_zh)}` : ""
        }</div>
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
    submitted_at: new Date().toISOString(),
    completed_cases: completedCount(),
    total_cases: data.cases.length,
    criteria: data.criteria.map((c) => c.key),
    methods: data.methods,
    scores,
  };
}

async function handleSubmit() {
  const done = completedCount();
  const total = data.cases.length;
  if (done < total) {
    const ok = confirm(
      `还有 ${total - done} 个 case 未完成。确定仍要提交吗？\nSubmit incomplete results (${done}/${total})?`
    );
    if (!ok) return;
  }

  const payload = buildPayload();
  els.btnSubmit.disabled = true;
  els.submitStatus.textContent = "Submitting...";

  try {
    if (isTokenConfigured()) {
      const result = await submitScores(payload);
      const action = result.updated ? "updated" : "created";
      els.submitStatus.innerHTML = `Submitted successfully (${action}). Issue <a href="${result.html_url}" target="_blank" rel="noopener">#${result.number}</a>`;
      saveSession({ ...session, lastSubmitAt: new Date().toISOString(), issueNumber: result.number });
      return;
    }

    // No token: open GitHub new-issue page (rater confirms once; must be logged into GitHub)
    const url = buildGitHubSubmitUrl(payload);
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      els.submitStatus.innerHTML = `弹窗被拦截。请手动打开：<a href="${url}" target="_blank" rel="noopener">提交到 GitHub</a>`;
    } else {
      els.submitStatus.innerHTML =
        "已打开 GitHub 提交页：请确认已登录 GitHub，然后点击 <strong>Submit new issue</strong>。提交后组织者可在 admin 页自动统计。";
    }
    saveSession({ ...session, lastSubmitAt: new Date().toISOString() });
  } catch (err) {
    els.submitStatus.innerHTML = `<span class="error">${escapeHtml(err.message || String(err))}</span>`;
  } finally {
    els.btnSubmit.disabled = false;
  }
}

function enterApp() {
  scores = loadScores();
  els.loginGate.hidden = true;
  els.loginGate.setAttribute("aria-hidden", "true");
  els.appRoot.hidden = false;
  els.appRoot.removeAttribute("aria-hidden");
  els.raterLabel.textContent = session.raterId;
  renderCase();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
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
  alert("All cases are complete.");
});
els.btnSubmit.addEventListener("click", handleSubmit);
els.btnExport.addEventListener("click", () => {
  const payload = buildPayload();
  download(`user_study_${payload.rater_id}_${Date.now()}.json`, JSON.stringify(payload, null, 2));
});
els.btnLogout.addEventListener("click", logout);

document.addEventListener("keydown", (e) => {
  if (els.appRoot.hidden) return;
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
