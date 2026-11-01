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

## Notes

- Scores are stored in the rater’s browser (`localStorage`).
- Use **Export JSON / Export CSV** and collect files from each rater.
- Method names stay blinded as A–E (same as the Word form).
