# 🌴 Reno Rampage

A beachside house renovation game — fix doors and windows before the paparazzi catch you!

## Local Development

```bash
npm install
npm run dev
```

Then open http://localhost:5173

## Deploy to Netlify (easiest)

### Option A: Drag & Drop (no GitHub needed)
1. Run `npm install && npm run build` locally
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
3. Drag the `dist` folder onto the page
4. Done! You'll get a live URL instantly

### Option B: Connect GitHub repo
1. Push this project to a GitHub repo (see below)
2. Go to [app.netlify.com](https://app.netlify.com) → "Add new site" → "Import an existing project"
3. Connect your GitHub account and select your repo
4. Build settings are already configured in `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click "Deploy site"
6. Every time you push to GitHub, Netlify auto-deploys

## Deploy to GitHub Pages

1. Push this project to a GitHub repo
2. Install gh-pages: `npm install --save-dev gh-pages`
3. Add to package.json scripts: `"deploy": "vite build && gh-pages -d dist"`
4. Run `npm run deploy`
5. In your repo settings → Pages → Source: "gh-pages" branch

## Push to GitHub

```bash
cd reno-rampage
git init
git add .
git commit -m "Initial commit - Reno Rampage game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reno-rampage.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.
