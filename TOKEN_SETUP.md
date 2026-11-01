# 开启「提交 / 自动统计」写入权限（一次性）

管理页读统计**不需要** Token（公开 Issues 可读）。
评测人点击 **Submit** 时需要一个仅限本仓库 Issues 权限的 Fine-grained PAT。

## 步骤

1. 打开：https://github.com/settings/personal-access-tokens/new
2. Token name: `user-study-submit`
3. Expiration: 建议 30–90 天（评测结束后撤销）
4. Resource owner: `Xi-Mu-Yu`
5. Repository access: **Only select repositories** → `image-edit-user-study`
6. Permissions → Repository permissions → **Issues: Read and write**
7. Generate，复制 token
8. 粘贴到 `assets/config.js` 的 `githubToken` 字段
9. 重新 `git add/commit/push`

评测口令（登录）：见 `config.js` 的 `studyPassword`  
管理口令（统计页）：见 `config.js` 的 `adminPassword`
