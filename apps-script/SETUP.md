# Wedding RSVP — Setup (≈10 minutes, one time)

The site (`index.html`) is a static page on GitHub Pages. RSVPs are sent to a
free **Google Apps Script** web app that appends each reply to a **Google
Sheet** you own. No servers, no cost.

## 1. Create the Sheet
1. Go to <https://sheets.google.com> and create a new blank spreadsheet.
2. Name it something like `Wedding RSVPs`. Leave it empty — the script adds a
   header row automatically on the first submission.

## 2. Add the script
1. In that spreadsheet: **Extensions → Apps Script**.
2. Delete the starter `function myFunction() {}` code.
3. Open `Code.gs` from this folder, copy **all** of it, and paste it in.
4. Click the **Save** icon (💾).

## 3. Deploy as a web app
1. Click **Deploy → New deployment**.
2. Click the gear ⚙ next to "Select type" → choose **Web app**.
3. Set:
   - **Description:** `RSVP` (anything)
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← important, so guests can submit
4. Click **Deploy**.
5. Click **Authorize access** and approve the permissions (it's your own
   script writing to your own sheet). If Google warns the app is
   "unverified," choose **Advanced → Go to (project) → Allow** — that's normal
   for personal Apps Scripts.
6. Copy the **Web app URL**. It ends in `/exec` — for example:
   `https://script.google.com/macros/s/AKfy.../exec`

## 4. Connect the page
1. Open `index.html`.
2. Near the bottom, find:
   ```js
   const SCRIPT_URL = "";
   ```
3. Paste your `/exec` URL between the quotes and save:
   ```js
   const SCRIPT_URL = "https://script.google.com/macros/s/AKfy.../exec";
   ```

## 5. Test it
1. Open `index.html` (locally: run `python3 -m http.server` in the repo, then
   visit <http://localhost:8000>; or just test on the live site after pushing).
2. Submit a test RSVP. You should see the "Thank you!" message.
3. Check your Google Sheet — a new row should appear with a timestamp.
4. Delete the test row when you're satisfied.

## Updating the script later
If you edit `Code.gs`, you must **re-deploy** for changes to take effect:
**Deploy → Manage deployments → ✏️ (edit) → Version: New version → Deploy.**
The `/exec` URL stays the same, so you don't need to touch `index.html` again.

## Good to know
- **Confirmed submissions (no silent data loss):** the form submits via JSONP,
  so the page can read the server's reply. It shows "Thank you!" **only** when
  the row actually saved (`result:"success"`). If the save fails or times out,
  the guest sees an error and can retry — you won't get a phantom "success"
  with no data behind it.
- **Spam:** a hidden honeypot field (`website`) is dropped server-side, so bots
  that auto-fill forms won't clutter your Sheet.
- **Quotas:** Apps Script's free quotas are far beyond any wedding's RSVP volume.
- **Re-deploy after editing `Code.gs`:** since `Code.gs` changed (it now handles
  JSONP), if your deployment was made from the older version you must push a new
  version: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
  The `/exec` URL stays the same.
