const STORAGE_KEY = "user-study-scores-v1";
const RATER_KEY = "user-study-rater-v1";

const els = {
  caseView: document.getElementById("caseView"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  jumpInput: document.getElementById("jumpInput"),
  caseTotal: document.getElementById("caseTotal"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  raterId: document.getElementById("raterId"),
  btnExport: document.getElementById("btnExport"),
  btnExportCsv: document.getElementById("btnExportCsv"),
  btnClear: document.getElementById("btnClear"),
  filterIncomplete: document.getElementById("filterIncomplete"),
};

let data = null;
let index = 0; // 0-based
let scores = loadScores();

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveScores() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
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

function updateProgress() {
  if (!data) return;
  const done = data.cases.filter(isCaseComplete).length;
  const total = data.cases.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  els.progressBar.style.backgroundSize = `${pct}% 100%`;
  els.progressText.textContent = `${done} / ${total} completed (${pct}%)`;
}

function setScore(caseId, method, criterion, value) {
  const key = caseKey(caseId);
  if (!scores[key]) scores[key] = {};
  if (!scores[key][method]) scores[key][method] = {};
  scores[key][method][criterion] = value;
  saveScores();
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
      setScore(
        item.id,
        btn.dataset.method,
        btn.dataset.crit,
        Number(btn.dataset.val)
      );
      renderCase();
    });
  });

  els.caseView.querySelectorAll("img[data-full]").forEach((img) => {
    img.addEventListener("click", () => openLightbox(img.dataset.full));
  });

  updateProgress();
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

function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const payload = {
    exported_at: new Date().toISOString(),
    rater_id: els.raterId.value.trim() || "anonymous",
    criteria: data.criteria,
    methods: data.methods,
    scores,
  };
  const name = `user_study_${payload.rater_id}_${Date.now()}.json`;
  download(name, JSON.stringify(payload, null, 2));
}

function exportCsv() {
  const rows = [["rater_id", "case_id", "image_id", "method", "criterion", "score"]];
  const rater = els.raterId.value.trim() || "anonymous";
  for (const c of data.cases) {
    const s = scores[caseKey(c.id)] || {};
    for (const m of data.methods) {
      for (const crit of data.criteria) {
        const val = s?.[m]?.[crit.key];
        rows.push([
          rater,
          c.id,
          c.image_id,
          m,
          crit.key,
          val == null ? "" : val,
        ]);
      }
    }
  }
  const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
  download(`user_study_${rater}_${Date.now()}.csv`, csv, "text/csv");
}

function jumpToIncomplete() {
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
}

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
els.btnExport.addEventListener("click", exportJson);
els.btnExportCsv.addEventListener("click", exportCsv);
els.btnClear.addEventListener("click", () => {
  if (!confirm("Clear all local scores in this browser?")) return;
  scores = {};
  saveScores();
  renderCase();
});
els.filterIncomplete.addEventListener("click", jumpToIncomplete);
els.raterId.value = localStorage.getItem(RATER_KEY) || "";
els.raterId.addEventListener("change", () => {
  localStorage.setItem(RATER_KEY, els.raterId.value.trim());
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key === "ArrowLeft") els.prevBtn.click();
  if (e.key === "ArrowRight") els.nextBtn.click();
});

const dataUrl = new URL("../data/cases.json", import.meta.url);
fetch(dataUrl)
  .then((r) => {
    if (!r.ok) throw new Error(`Failed to load cases.json (${r.status})`);
    return r.json();
  })
  .then((json) => {
    data = json;
    renderCase();
  })
  .catch((err) => {
    els.caseView.innerHTML = `<p style="color:#b42318">Failed to load data/cases.json. Open this site via a local server or GitHub Pages (not file://).<br/>${escapeHtml(
      err.message
    )}</p>`;
  });
