/* ============================================================
   ORIBRIX VENDOR ONBOARDING ACADEMY - SETTINGS
   This is the only file you normally need to edit.
   ============================================================ */
window.ACADEMY_CONFIG = {
  // 1) Paste your Google Apps Script "Web app" URL here (see README, step 3).
  //    While this is empty the site runs in TEST MODE: progress is kept only in
  //    this browser, a sample quiz is used, and nothing is saved to Google Sheets.
  API_URL: "",

  // 2) Course text
  COURSE_NAME: "Oribrix Vendor Onboarding Academy",
  ORG_NAME: "Oribrix Technologies Private Limited",
  SIGNATORY_NAME: "Ayush Rai",
  SIGNATORY_TITLE: "CEO, Oribrix",

  // 3) Rules
  COMPLETE_THRESHOLD: 0.98,   // share of a video that must be watched to count as complete
  SEQUENTIAL: true,           // module N unlocks only after module N-1 is complete
  SPEEDS: [0.1, 0.2, 0.5, 0.8, 1, 2, 3],
  DEFAULT_LANG: "en",         // "en" or "hi" (Hinglish)

  // 4) Public address of the site, used in the certificate's verify link.
  //    Leave empty to use the current address automatically.
  SITE_URL: ""
};
