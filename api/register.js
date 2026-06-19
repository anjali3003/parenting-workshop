// api/register.js
// Called when the user submits the sign-up form.
// 1. Validates input
// 2. Saves registration to Google Sheets (status: Pending)
// 3. Creates a Razorpay order and returns the order ID to the frontend

const Razorpay = require("razorpay");
const { addRegistration, ensureSheetHeaders } = require("../lib/sheets");

const WORKSHOP_AMOUNT_PAISE = 49900; // ₹499 in paise (Razorpay uses smallest currency unit)

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate Indian/international phone (10+ digits)
function isValidPhone(phone) {
  return /^\+?[\d\s\-]{10,}$/.test(phone);
}

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // CORS headers (allows your frontend to call this)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const { name, email, phone, childAge, whatsappOptIn } = req.body;

    // ── Validation ──────────────────────────────────────────
    const errors = {};
    if (!name || name.trim().length < 2) errors.name = "Please enter your full name";
    if (!email || !isValidEmail(email)) errors.email = "Please enter a valid email";
    if (!phone || !isValidPhone(phone)) errors.phone = "Please enter a valid phone number";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: "Validation failed", fields: errors });
    }

    // ── Save to Google Sheets ────────────────────────────────
    await ensureSheetHeaders();
    await addRegistration({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      childAge,
      whatsappOptIn,
    });

    // ── Create Razorpay Order ────────────────────────────────
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: WORKSHOP_AMOUNT_PAISE,
      currency: "INR",
      receipt: `reg_${Date.now()}`,
      notes: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        workshop: "Confident Kids Workshop — July 20",
      },
    });

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      // Send back key_id so frontend can open Razorpay checkout
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });

  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
      detail: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
