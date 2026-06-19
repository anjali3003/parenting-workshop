// api/verify-payment.js
// Called by the frontend immediately after Razorpay checkout closes successfully.
// This is a client-side confirmation (the webhook is the authoritative one).
// We verify the payment signature here as a UX layer so the user sees
// the success screen right away without waiting for the webhook.

const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // Verify signature: HMAC of "order_id|payment_id" with key_secret
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.warn("Payment signature mismatch");
      return res.status(400).json({ verified: false, error: "Signature mismatch" });
    }

    // Signature valid — payment is genuine
    return res.status(200).json({ verified: true, paymentId: razorpay_payment_id });

  } catch (err) {
    console.error("Verify payment error:", err);
    return res.status(500).json({ verified: false, error: "Verification failed" });
  }
};
