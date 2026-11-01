# User Study Evaluation (GitHub Pages)

Static online form converted from `图像效果.docx`.

## Local preview

```bash
cd gh-pages-user-study
python -m http.server 8080
```

Open `http://127.0.0.1:8080`.

## Rebuild from docx

```bash
python build_from_docx.py
```

## Deploy to GitHub Pages

1. Create a **new empty GitHub repository** (public), e.g. `image-edit-user-study`.
2. In this folder:

```bash
git init -b main
git add .
git commit -m "Add user study GitHub Pages site"
git remote add origin https://github.com/<YOUR_USER>/<REPO>.git
git push -u origin main
```

3. On GitHub: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: `main` / `/ (root)`
4. After 1–2 minutes, open:

`https://<YOUR_USER>.github.io/<REPO>/`

## Usage

1. Raters open the site → login with **Rater ID + study password**
2. Score all cases (auto-saved locally)
3. Click **Submit** once (writes to GitHub Issues)
4. Organizer opens [`admin.html`](./admin.html) with admin password for auto stats

Default passwords are in `assets/config.js` (`studyPassword` / `adminPassword`).

## Submit modes

- **Default (no token):** Submit opens a GitHub Issue draft; rater clicks **Submit new issue** once (needs GitHub login).
- **One-click (optional):** Add a fine-grained PAT in `assets/config.js` — see [TOKEN_SETUP.md](./TOKEN_SETUP.md).

## Passwords (change in `assets/config.js`)

- Study login: `WhereEdit2026`
- Admin stats: `WhereEditAdmin2026`

## Notes

- Method names stay blinded as A–E on the form and admin page.
- Map A–E back to real methods offline with your local shuffle mapping table.
- Live site: https://xi-mu-yu.github.io/image-edit-user-study/
