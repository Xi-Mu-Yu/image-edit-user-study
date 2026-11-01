import { CONFIG } from "./config.js";
import { fetchAllSubmissions } from "./store.js";

const els = {
  gate: document.getElementById("adminGate"),
  form: document.getElementById("adminLogin"),
  password: document.getElementById("adminPassword"),
  error: document.getElementById("adminError"),
  root: document.getElementById("adminRoot"),
  summaryLine: document.getElementById("summaryLine"),
  meanTable: document.getElementById("meanTable"),
  subTable: document.getElementById("subTable"),
  btnRefresh: document.getElementById("btnRefresh"),
  btnExportAll: document.getElementById("btnExportAll"),
};

let submissions = [];
let methods = ["A", "B", "C", "D", "E"];
let criteria = ["semantics", "background"];

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function collectValues(method, criterion) {
  const vals = [];
  for (const sub of submissions) {
    const scores = sub.payload.scores || {};
    for (const caseId of Object.keys(scores)) {
      const v = scores[caseId]?.[method]?.[criterion];
      if (typeof v === "number") vals.push(v);
    }
  }
  return vals;
}

function renderMeans() {
  const head = ["Criterion", ...methods.map((m) => `${m} (mean±std, n)`)];
  const rows = criteria.map((crit) => {
    const cells = methods.map((m) => {
      const vals = collectValues(m, crit);
      if (!vals.length) return "-";
      return `${mean(vals).toFixed(3)} ± ${std(vals).toFixed(3)} (n=${vals.length})`;
    });
    return [crit, ...cells];
  });

  els.meanTable.innerHTML = `
    <thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
    </tbody>
  `;
}

function renderSubs() {
  els.subTable.innerHTML = `
    <thead>
      <tr>
        <th>#</th><th>Rater</th><th>Completed</th><th>Submitted</th><th>Issue</th>
      </tr>
    </thead>
    <tbody>
      ${submissions
        .map((s) => {
          const p = s.payload;
          return `<tr>
            <td>${s.number}</td>
            <td>${escapeHtml(p.rater_id)}</td>
            <td>${p.completed_cases}/${p.total_cases}</td>
            <td>${escapeHtml(p.submitted_at || s.updated_at)}</td>
            <td><a href="${s.html_url}" target="_blank" rel="noopener">open</a></td>
          </tr>`;
        })
        .join("")}
    </tbody>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function load() {
  els.summaryLine.textContent = "Loading submissions from GitHub Issues...";
  submissions = await fetchAllSubmissions();
  if (submissions[0]?.payload?.methods) methods = submissions[0].payload.methods;
  if (submissions[0]?.payload?.criteria) criteria = submissions[0].payload.criteria;

  els.summaryLine.textContent = `${submissions.length} submission(s) loaded · updated ${new Date().toLocaleString()}`;
  renderMeans();
  renderSubs();
}

function exportCsv() {
  const rows = [["rater_id", "case_id", "method", "criterion", "score", "submitted_at"]];
  for (const s of submissions) {
    const p = s.payload;
    const scores = p.scores || {};
    for (const caseId of Object.keys(scores)) {
      for (const m of methods) {
        for (const c of criteria) {
          const v = scores[caseId]?.[m]?.[c];
          if (v == null) continue;
          rows.push([p.rater_id, caseId, m, c, v, p.submitted_at || ""]);
        }
      }
    }
  }
  const csv = rows.map((r) => r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `user_study_all_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  els.error.hidden = true;
  if (els.password.value !== CONFIG.adminPassword) {
    els.error.textContent = "Wrong admin password.";
    els.error.hidden = false;
    return;
  }
  els.gate.hidden = true;
  els.root.hidden = false;
  try {
    await load();
  } catch (err) {
    els.summaryLine.innerHTML = `<span class="error">${escapeHtml(err.message || String(err))}</span>`;
  }
});

els.btnRefresh.addEventListener("click", () => load().catch((err) => alert(err.message)));
els.btnExportAll.addEventListener("click", exportCsv);
