import { CONFIG } from "./config.js";

const API = "https://api.github.com";

function authHeaders() {
  if (!CONFIG.githubToken || CONFIG.githubToken.startsWith("REPLACE_")) {
    throw new Error(
      "提交功能尚未配置 GitHub Token。请管理员在 assets/config.js 填入 fine-grained PAT。"
    );
  }
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${CONFIG.githubToken}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function publicHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function issueTitle(raterId) {
  return `submission:${String(raterId).trim()}`;
}

export function wrapBody(payload) {
  return [
    `<!-- user-study-submission -->`,
    `Rater: **${payload.rater_id}**`,
    `Submitted: ${payload.submitted_at}`,
    `Completed cases: ${payload.completed_cases}/${payload.total_cases}`,
    "",
    "```json",
    JSON.stringify(payload),
    "```",
  ].join("\n");
}

function parseIssuePayload(issue) {
  const body = issue.body || "";
  const m = body.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  try {
    const raw = JSON.parse(m[1]);
    return expandPayload(raw);
  } catch {
    return null;
  }
}

/** Pack scores into a short base64 string for GitHub web-submit URLs. */
export function compactPayload(payload) {
  const methods = payload.methods || ["A", "B", "C", "D", "E"];
  const criteria = payload.criteria || ["semantics", "background"];
  const total = payload.total_cases || 60;
  const bytes = [];
  for (let caseId = 1; caseId <= total; caseId++) {
    const row = payload.scores?.[String(caseId)] || {};
    for (const m of methods) {
      for (const c of criteria) {
        const v = row?.[m]?.[c];
        bytes.push(typeof v === "number" && v >= 1 && v <= 5 ? v : 0);
      }
    }
  }
  // 4-bit pack
  const packed = [];
  for (let i = 0; i < bytes.length; i += 2) {
    const a = bytes[i] & 0xf;
    const b = (bytes[i + 1] ?? 0) & 0xf;
    packed.push((a << 4) | b);
  }
  const bin = String.fromCharCode(...packed);
  const b64 = btoa(bin);
  return {
    schema: 2,
    rater_id: payload.rater_id,
    submitted_at: payload.submitted_at,
    completed_cases: payload.completed_cases,
    total_cases: total,
    criteria,
    methods,
    packed: b64,
  };
}

export function expandPayload(raw) {
  if (!raw) return null;
  if (raw.schema !== 2 || !raw.packed) return raw;
  const methods = raw.methods || ["A", "B", "C", "D", "E"];
  const criteria = raw.criteria || ["semantics", "background"];
  const total = raw.total_cases || 60;
  const bin = atob(raw.packed);
  const nibbles = [];
  for (let i = 0; i < bin.length; i++) {
    const byte = bin.charCodeAt(i);
    nibbles.push((byte >> 4) & 0xf, byte & 0xf);
  }
  const scores = {};
  let k = 0;
  for (let caseId = 1; caseId <= total; caseId++) {
    const row = {};
    let any = false;
    for (const m of methods) {
      row[m] = {};
      for (const c of criteria) {
        const v = nibbles[k++] || 0;
        if (v >= 1 && v <= 5) {
          row[m][c] = v;
          any = true;
        }
      }
    }
    if (any) scores[String(caseId)] = row;
  }
  return { ...raw, schema: 1, scores, packed: undefined };
}

async function findIssueByRater(raterId) {
  const title = issueTitle(raterId);
  const res = await fetch(
    `${API}/repos/${CONFIG.owner}/${CONFIG.repo}/issues?labels=${encodeURIComponent(
      CONFIG.label
    )}&state=all&per_page=100`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error(`查找已有提交失败 (${res.status})`);
  const items = await res.json();
  return items.find((it) => it.title === title) || null;
}

export async function submitScores(payload) {
  const title = issueTitle(payload.rater_id);
  const body = wrapBody(payload);
  const existing = await findIssueByRater(payload.rater_id);

  if (existing) {
    const res = await fetch(
      `${API}/repos/${CONFIG.owner}/${CONFIG.repo}/issues/${existing.number}`,
      {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ body, state: "open" }),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`更新提交失败 (${res.status}): ${t}`);
    }
    return { updated: true, number: existing.number, html_url: existing.html_url };
  }

  const res = await fetch(`${API}/repos/${CONFIG.owner}/${CONFIG.repo}/issues`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      title,
      body,
      labels: [CONFIG.label],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`提交失败 (${res.status}): ${t}`);
  }
  const issue = await res.json();
  return { updated: false, number: issue.number, html_url: issue.html_url };
}

/** Open GitHub "new issue" page — no token required; rater confirms once on GitHub. */
export function buildGitHubSubmitUrl(payload) {
  const compact = compactPayload(payload);
  const title = issueTitle(payload.rater_id);
  const body = wrapBody(compact);
  const base = `https://github.com/${CONFIG.owner}/${CONFIG.repo}/issues/new`;
  const params = new URLSearchParams({
    title,
    labels: CONFIG.label,
    body,
  });
  return `${base}?${params.toString()}`;
}

export async function fetchAllSubmissions() {
  const items = [];
  let page = 1;
  while (page <= 10) {
    const res = await fetch(
      `${API}/repos/${CONFIG.owner}/${CONFIG.repo}/issues?labels=${encodeURIComponent(
        CONFIG.label
      )}&state=all&per_page=100&page=${page}`,
      { headers: publicHeaders() }
    );
    if (!res.ok) throw new Error(`读取提交失败 (${res.status})`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return items
    .map((issue) => {
      const payload = parseIssuePayload(issue);
      if (!payload) return null;
      return {
        number: issue.number,
        html_url: issue.html_url,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        payload,
      };
    })
    .filter(Boolean);
}

export function isTokenConfigured() {
  return Boolean(CONFIG.githubToken && !CONFIG.githubToken.startsWith("REPLACE_"));
}
