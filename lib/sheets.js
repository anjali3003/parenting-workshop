// lib/sheets.js
// Handles all Google Sheets read/write operations
// The spreadsheet acts as our database for registrations

const { google } = require("googleapis");

// Column layout in the Google Sheet:
// A: Timestamp | B: Name | C: Email | D: Phone | E: WhatsApp Opt-in
// F: Child Age Group | G: Payment Status | H: Payment ID | I: Amount Paid

const SHEET_NAME = "Registrations";

/**
 * Returns an authenticated Google Sheets client.
 * Credentials come from environment variables (set in Vercel dashboard).
 */
async function getSheetClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

/**
 * Appends a new registration row to the sheet.
 * Called when a user submits the sign-up form (before payment).
 */
async function addRegistration({ name, email, phone, childAge, whatsappOptIn }) {
  const sheets = await getSheetClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const timestamp = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "short",
    timeStyle: "short",
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          timestamp,          // A: Timestamp
          name,               // B: Name
          email,              // C: Email
          phone,              // D: Phone
          whatsappOptIn ? "Yes" : "No", // E: WhatsApp opt-in
          childAge || "",     // F: Child age group
          "Pending",          // G: Payment status
          "",                 // H: Payment ID (filled after payment)
          "",                 // I: Amount paid (filled after payment)
        ],
      ],
    },
  });

  return { success: true };
}

/**
 * Updates an existing row's payment status after Razorpay confirms payment.
 * Finds the row by email address.
 */
async function markPaymentComplete({ email, paymentId, amount }) {
  const sheets = await getSheetClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Read all rows to find the matching email
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A:I`,
  });

  const rows = response.data.values || [];
  let targetRow = -1;

  // Find the last row with this email and "Pending" status
  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][2] === email && rows[i][6] === "Pending") {
      targetRow = i + 1; // Sheets rows are 1-indexed
      break;
    }
  }

  if (targetRow === -1) {
    console.error(`No pending registration found for email: ${email}`);
    return { success: false, error: "Registration not found" };
  }

  // Update columns G, H, I for that row
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: `${SHEET_NAME}!G${targetRow}:I${targetRow}`,
          values: [["Paid ✓", paymentId, `₹${amount / 100}`]],
        },
      ],
    },
  });

  return { success: true };
}

/**
 * Ensures the sheet has a header row on first use.
 * Safe to call every time — checks before writing.
 */
async function ensureSheetHeaders() {
  const sheets = await getSheetClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:I1`,
  });

  const firstRow = response.data.values?.[0];
  const alreadyHasHeaders = firstRow && firstRow[0] === "Timestamp";

  if (!alreadyHasHeaders) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:I1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            "Timestamp",
            "Name",
            "Email",
            "Phone",
            "WhatsApp Opt-in",
            "Child Age Group",
            "Payment Status",
            "Payment ID",
            "Amount Paid",
          ],
        ],
      },
    });
  }
}

module.exports = { addRegistration, markPaymentComplete, ensureSheetHeaders };
