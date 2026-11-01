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

function issueTitle(raterId) {
  return `submission:${String(raterId).trim()}`;
}

function wrapBody(payload) {
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
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

async function findIssueByRater(raterId) {
  const q = encodeURIComponent(
    `repo:${CONFIG.owner}/${CONFIG.repo} is:issue label:${CONFIG.label} in:title "${issueTitle(raterId)}"`
  );
  const res = await fetch(`${API}/search/issues?q=${q}&per_page=5`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    // fallback list
    return findIssueByRaterFallback(raterId);
  }
  const data = await res.json();
  const exact = (data.items || []).find((it) => it.title === issueTitle(raterId));
  return exact || null;
}

async function findIssueByRaterFallback(raterId) {
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
