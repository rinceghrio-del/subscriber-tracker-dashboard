# Subscriber Tracker — PC Admin Dashboard

A static web page (no build step, no install) where you manage all subscribers: add, edit,
delete, and see who's overdue or due soon, with browser notifications.

Uses the **same Firebase project** as the Android app — same `subscribers` collection.

## ⚠️ Required setup before this works

### 1. Get your Firebase Web config
1. Firebase Console → your project ("Rustech Subscriber Tracker") → ⚙️ **Project settings**.
2. Scroll to **Your apps**. If there's no web app (`</>`) yet, click **Add app → Web**, give it any nickname, skip hosting setup.
3. Copy the `firebaseConfig` object shown.
4. Open `firebase-config.js` in this folder and paste your real values in (replacing the `PLACEHOLDER-REPLACE-ME` ones).

### 2. Create your admin account
This should be a **separate account from your subscriber test account** (`rinceghrio@gmail.com`).
1. Firebase Console → **Authentication → Users → Add user**.
2. Enter your own email + a password you'll remember. Click **Add user**.
3. Open `firebase-config.js` and add that email to the `ADMIN_EMAILS` array.
4. Open `firestore.rules` in this folder and replace `"your-admin-email@gmail.com"` with the same email.

### 3. Update Firestore security rules
1. Firebase Console → **Firestore Database → Rules**.
2. Replace everything with the contents of `firestore.rules` (from this folder — it now allows
   your admin email to write, on top of the existing subscriber read-only rule).
3. Click **Publish**.

## Hosting it (GitHub Pages — free, no build step)

1. Push this whole `SubscriberTracker-PCDashboard` folder to a GitHub repo (can be the same repo
   as the Android app, in a subfolder, or its own repo — your call).
2. In the repo: **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Branch: `main`, folder: `/ (root)` if this is its own repo, or `/docs` if you put it in a
   subfolder named `docs`. Save.
5. Wait ~1 minute, then GitHub shows you the live URL (something like
   `https://yourusername.github.io/your-repo/`). Bookmark that — it's your dashboard from now on.

You can also just open `index.html` directly on your PC (double-click it) without hosting
anywhere — it'll work the same, since everything talks straight to Firebase. GitHub Pages is
just handy if you want to check it from any device with a link.

## Using it

- **Log in** with the admin account you created in step 2 above.
- **Add subscriber**: name, email (becomes their login + record ID — must match exactly what
  they'll register with in the Android app), due date, monthly amount, status.
- Rows with a **red left border** are overdue; **yellow** means due within 3 days.
- The three summary cards at the top give you an at-a-glance count.
- **Browser notifications**: the first time you load the dashboard, your browser will ask for
  notification permission — allow it. Each overdue/due-soon subscriber triggers one notification
  per day (won't spam you on every refresh).
- Click any row to edit it or delete it.

## Known limitations (fine for v1)

- Notifications only fire while the dashboard tab is open in your browser — there's no
  server-side push yet. If you want reminders even when the dashboard isn't open, that would need
  a scheduled Cloud Function (Blaze/paid plan) — let Claude know if you want that added later.
- Editing a subscriber's email isn't supported directly (since email = document ID). To change
  someone's email, delete the old record and add a new one with the corrected email.
