# Going Live — Step by Step Setup Guide

This walks you through everything: Google Sheet as DB → Razorpay payments → Vercel hosting.
Total cost: **₹0/month**. You only pay Razorpay's ~2% fee per transaction.

Total time: roughly 45–60 minutes the first time.

---

## PART 1 — Set up Google Sheets as your database

### 1.1 Create the Sheet
1. Go to [sheets.google.com](https://sheets.google.com) → Create a blank spreadsheet
2. Rename it: `Workshop Registrations`
3. Rename the bottom tab from "Sheet1" to **`Registrations`** (must match exactly — double-click the tab)
4. Copy the Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_LONG_ID`**`/edit`
   → Save this somewhere, you'll need it later.

### 1.2 Create a Google Cloud Service Account (this lets your code write to the sheet)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **New Project** → name it `parenting-workshop` → Create
3. In the search bar, type **"Google Sheets API"** → click it → **Enable**
4. In the left menu: **IAM & Admin → Service Accounts → Create Service Account**
   - Name: `workshop-bot`
   - Click **Create and Continue** → skip the optional steps → **Done**
5. Click on the service account you just created → go to **Keys** tab
6. **Add Key → Create New Key → JSON** → it downloads a `.json` file
7. Open that JSON file in a text editor. You need two values from it:
   - `client_email` → looks like `workshop-bot@parenting-workshop-123.iam.gserviceaccount.com`
   - `private_key` → a long string starting with `-----BEGIN PRIVATE KEY-----`

### 1.3 Share the Sheet with the service account
1. Go back to your Google Sheet
2. Click **Share** (top right)
3. Paste the `client_email` from step 1.2 → give it **Editor** access → Send

✅ Your database is ready. Every form submission will now be writable.

---

## PART 2 — Set up Razorpay (payment gateway)

### 2.1 Create your account
1. Go to [razorpay.com](https://razorpay.com) → Sign up
2. Complete KYC (PAN, bank account) — needed to receive real payments. You can test everything before KYC is approved using Test Mode.

### 2.2 Get your API keys
1. Dashboard → **Settings → API Keys**
2. Generate keys → copy:
   - `Key Id` (starts with `rzp_test_` while testing, `rzp_live_` once approved)
   - `Key Secret`
3. Keep these private — never put them in your HTML/frontend code (they're already kept server-side in the code I built).

### 2.3 Set up the webhook (confirms payments automatically)
1. Dashboard → **Settings → Webhooks → Add New Webhook**
2. Webhook URL: `https://YOUR-DOMAIN.vercel.app/api/payment-webhook` (you'll get this domain in Part 3 — come back to this step after deploying)
3. Active events: check **`payment.captured`** and **`payment.failed`**
4. Set a **Secret** (any password you choose) → Save this, you'll need it as `RAZORPAY_WEBHOOK_SECRET`

---

## PART 3 — Deploy to Vercel (free hosting)

### 3.1 Get the project onto GitHub (Vercel deploys from GitHub)
1. Unzip the project file I gave you (`parenting-workshop-project.zip`)
2. Go to [github.com](https://github.com) → New Repository → name it `parenting-workshop` → Create
3. Upload all the files from the unzipped folder into that repo
   (Easiest way: on the repo page, click **"uploading an existing file"** and drag the folder contents in)

### 3.2 Connect Vercel
1. Go to [vercel.com](https://vercel.com) → Sign up using your GitHub account (free)
2. Click **Add New → Project**
3. Select your `parenting-workshop` repo → **Import**
4. Before clicking Deploy, click **Environment Variables** and add all of these:

| Key | Value |
|---|---|
| `RAZORPAY_KEY_ID` | from Part 2.2 |
| `RAZORPAY_KEY_SECRET` | from Part 2.2 |
| `RAZORPAY_WEBHOOK_SECRET` | from Part 2.3 |
| `GOOGLE_SHEET_ID` | from Part 1.1 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | from Part 1.2 (the client_email) |
| `GOOGLE_PRIVATE_KEY` | from Part 1.2 (the private_key — paste the whole thing including BEGIN/END lines) |

5. Click **Deploy**
6. After ~60 seconds, Vercel gives you a live URL like `parenting-workshop.vercel.app`

### 3.3 Finish the webhook setup
1. Copy your new Vercel URL
2. Go back to Razorpay → Settings → Webhooks → edit the webhook you made
3. Paste in: `https://parenting-workshop.vercel.app/api/payment-webhook`
4. Save

### 3.4 (Optional) Add your own domain
1. Buy a domain (GoDaddy, Namecheap — ~₹600–1000/year, the only real cost in this whole stack)
2. In Vercel: Project → Settings → Domains → add your domain → follow the DNS instructions they show you

---

## PART 4 — Test before going live

1. Open your live URL
2. Fill the sign-up form with a test name/email/phone
3. On the payment screen, since you're in **Test Mode**, use Razorpay's test card:
   - Card number: `4111 1111 1111 1111`
   - Any future expiry, any CVV
4. Check your Google Sheet — a new row should appear, and after payment, the status column should flip to **"Paid ✓"**
5. Once it all works, go to Razorpay Dashboard → toggle from **Test Mode** to **Live Mode**, and replace your `RAZORPAY_KEY_ID`/`SECRET` in Vercel's environment variables with the **live** keys (`rzp_live_...`)

---

## You're live 🎉

From here on:
- New registrations → appear instantly in your Google Sheet
- New payments → automatically marked "Paid ✓" in the same row
- You never touch code again — just check the Sheet each morning

## If something breaks
- Vercel → your project → **Deployments** tab → click the latest one → **Logs** shows you exactly what failed (usually a missing/mistyped environment variable)
