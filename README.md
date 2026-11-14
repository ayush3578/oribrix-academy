# Oribrix Vendor Onboarding Academy

A self-hosted training website. It has 8 narrated video modules in **English** and **Hinglish**, a final quiz, and a downloadable certificate.
It runs on **GitHub Pages** (free). Quiz results and learner progress are saved to a **Google Sheet** (free).

## What it does

- **Registration with name and mobile.** The name is locked to the mobile number and printed on the certificate. It can't be changed later.
- **Videos must be watched fully.** Skipping ahead is blocked, both on the seek bar and by script. Going back is allowed.
  A module counts as complete only after 98% of it has been watched (you can change this in `config.js`).
- **Speeds:** 0.1x, 0.2x, 0.5x, 0.8x, 1x, 2x and 3x. Subtitles can be turned on or off.
  If the learner leaves the tab, the video pauses. When they come back, it resumes from where they stopped.
- **Modules unlock in order.** Module 2 opens after module 1, and so on. The quiz opens only after all 8 are complete.
- **One quiz attempt per mobile number.** This is checked on the server, so another browser or phone doesn't get a second attempt.
- **Questions and answers live only in the Google Sheet.** The website never receives the correct answers before a learner submits.
- **Each learner gets 16 questions** (2 per module), picked at random from the question bank. The set stays the same if they reload the page.
- **Certificate:** PNG and PDF download, with a certificate ID and a QR code. Anyone can check a certificate at `yoursite/?verify=CERT-ID`.
- **English / Hinglish switch** for both the videos and the website text.

## Folder structure

```
index.html              the website (single page)
assets/js/config.js     <- SETTINGS: paste your Google Apps Script URL here
assets/js/i18n.js       website text (English + Hinglish)
assets/js/app.js        website logic (player, quiz, certificate)
assets/js/api.js        talks to Google Sheets (or local test mode)
assets/css/style.css    design
assets/img/             Oribrix logo files
assets/vendor/          jsPDF and QR code libraries (self-hosted)
data/course.json        module list: titles, descriptions, video files, durations, chapters
data/quiz-sample.json   3 sample questions used only in TEST MODE
videos/en/, videos/hi/  module videos (.mp4) and subtitles (.vtt)
backend/Code.gs         Google Apps Script backend (paste into your Google Sheet)
```

## Setup (about 15 minutes)

### 1. Put the site on GitHub Pages
1. Create a new repository on GitHub, for example `oribrix-academy`.
2. Upload **everything in this folder** to the repository.
   Each video is under GitHub's 100 MB file limit. The whole site is about 400–500 MB, which is within GitHub's recommended 1 GB per repository.
   With many videos, the GitHub Desktop app or `git` is easier than uploading through the browser.
3. Go to **Settings → Pages**. Set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**, then click Save.
4. After a minute, your site is live at `https://YOUR-USERNAME.github.io/oribrix-academy/`.

At this point the site works in **TEST MODE**: progress is kept only in that browser. Continue with step 2 to save real results.

### 2. Create the Google Sheet backend
1. Create a new Google Sheet, for example "Oribrix Academy Results".
2. Click **Extensions → Apps Script**. Delete any code you see there, paste in all of `backend/Code.gs`, and click **Save**.
3. In the function dropdown, choose **`setup`** and click **Run**. Allow the permissions Google asks for.
   This creates 5 tabs: **Learners, Progress, Results, Quiz, Settings**. The Quiz tab comes filled with 24 questions in English and Hinglish.
4. Click **Deploy → New deployment**. For type, choose **Web app**. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**

   Then click **Deploy** and copy the **Web app URL**. It ends in `/exec`.

### 3. Connect the site to the Sheet
1. Open `assets/js/config.js` and paste the Web app URL into `API_URL: "..."`.
2. Optional: set `SITE_URL` to your GitHub Pages address, so the QR codes on certificates point there.
3. Commit the change. The yellow "TEST MODE" bar disappears and results start saving to the Sheet.

## Day-to-day maintenance

| You want to… | Do this |
|---|---|
| See who completed what | **Progress** tab (one row per completed module) and **Results** tab (scores, certificate IDs) |
| Edit, add or remove quiz questions | **Quiz** tab. `correct` is A, B, C or D. Set `active` to FALSE to hide a question. The `_hi` columns hold the Hinglish text. |
| Change how many questions each learner gets | **Settings** → `QUESTIONS_PER_MODULE` (default 2, so 16 questions) |
| Change the pass mark | **Settings** → `PASS_PERCENT` (set to **80**: learners need 80% or more for a certificate; 0 = everyone who submits) |
| Let someone retake the quiz (e.g. after failing) | Delete that person's row in **Results** |
| Fix a learner's name | Edit their row in **Learners** (and in **Results**, if they already have a certificate) |
| Check possible duplicates | **Results** → `same_name_other_mobile` shows **CHECK** when the same name was used with a different mobile number |
| Replace a video | Upload the new `videos/en/module-0N.mp4` (and `.vtt`). Update the `duration` for that module in `data/course.json` |
| Change website text | `assets/js/i18n.js` (both languages) |
| Turn off "modules in order" | `config.js` → `SEQUENTIAL: false` |

**After editing `Code.gs`**, publish the change: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

## Good to know

- **Privacy:** learners' mobile numbers are stored only in your Google Sheet. The certificate and the verify page show only the name, date and score. Keep the Sheet private.
- **Watch enforcement** is strong enough for normal use: skipping is blocked and the tab pauses when hidden. A technically skilled person could still fake progress with browser developer tools, as with any website-only check.
- **Hinglish voice** is an AI voice. English words are pronounced in English and Hindi words in Hindi. Subtitles are in Roman Hinglish.
- Module 8 lists items that were **pending as of 13 Nov 2026**. Re-record or re-render that section when they're done.
- **Sensitive details** from the recording (passwords, OTP screens, phone numbers and a customer address) were cut or blurred in the videos.
