// api/payment-webhook.js
// Razorpay calls this URL automatically after every payment succeeds or fails.
// This is the most secure way to confirm payments — never trust the frontend alone.
//
// Flow:
//   Razorpay processes payment → sends POST to this endpoint →
//   we verify the signature → update Google Sheet row to "Paid ✓"

const crypto = require("crypto");
const { markPaymentComplete } = require("../lib/sheets");

/**
 * Verifies that the webhook actually came from Razorpay
 * by checking the HMAC-SHA256 signature.
 */
function verifyWebhookSignature(rawBody, signature, secret) {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return expectedSignature === signature;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Razorpay sends the raw body — we need it as a string for signature verification
    const rawBody =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    const signature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // ── Security check ───────────────────────────────────────
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.warn("Invalid Razorpay webhook signature — ignoring");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const eventType = event.event;

    // ── Handle payment.captured (money actually received) ────
    if (eventType === "payment.captured") {
      const payment = event.payload.payment.entity;

      const email = payment.notes?.email || payment.email;
      const paymentId = payment.id;
      const amount = payment.amount; // in paise

      if (!email) {
        console.error("No email in payment notes:", payment.notes);
        return res.status(200).json({ received: true }); // Still return 200 so Razorpay doesn't retry
      }

      await markPaymentComplete({ email, paymentId, amount });

      console.log(`✓ Payment confirmed for ${email} — ${paymentId}`);
      return res.status(200).json({ received: true, status: "updated" });
    }

    // ── Handle payment.failed ────────────────────────────────
    if (eventType === "payment.failed") {
      const payment = event.payload.payment.entity;
      console.warn(`✗ Payment failed for order ${payment.order_id}`);
      // You could update the sheet to "Failed" here if you want visibility
      return res.status(200).json({ received: true, status: "noted" });
    }

    // All other events — just acknowledge
    return res.status(200).json({ received: true, status: "ignored" });

  } catch (err) {
    console.error("Webhook handler error:", err);
    // Always return 200 to Razorpay to prevent infinite retries
    return res.status(200).json({ received: true, error: "Internal error" });
  }
};

// Tell Vercel to give us raw body (needed for signature verification)
export const config = {
  api: {
    bodyParser: false,
  },
};
