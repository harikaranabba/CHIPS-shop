const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
require("dotenv").config();

const Razorpay = require("razorpay");

const app = express();
const path = require("path");

// ===============================
// SUPABASE
// ===============================

console.log("SUPABASE URL loaded:", !!process.env.SUPABASE_URL);
console.log("SUPABASE KEY loaded:", !!process.env.SUPABASE_KEY);

// ===============================
// RAZORPAY
// ===============================

console.log("RAZORPAY KEY loaded:", !!process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY SECRET loaded:", !!process.env.RAZORPAY_KEY_SECRET);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "website")));

// ===============================
// CREATE RAZORPAY ORDER
// ===============================

app.post("/create-order", async (req, res) => {
  try {
    console.log("CREATE ORDER BODY:", req.body);

    const {
      amount,
      phone,
      product,
      quantity,
      unit
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount"
      });
    }

    // Razorpay expects amount in paise
    const amountInPaise = Math.round(Number(amount) * 100);

    const receipt = "billdesk_" + Date.now();

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt,
      notes: {
        product: String(product || ""),
        quantity: String(quantity || ""),
        unit: String(unit || ""),
        phone: String(phone || "")
      }
    });

    console.log("RAZORPAY ORDER CREATED:", razorpayOrder.id);

    // Save order in Supabase
    const dbResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          order_id: razorpayOrder.id,
          product: product,
          amount: Number(amount),
          quantity: quantity,
          unit: unit,
          phone: phone,
          payment_status: "CREATED"
        })
      }
    );

    const dbText = await dbResponse.text();

    console.log("SUPABASE STATUS:", dbResponse.status);
    console.log("SUPABASE RESPONSE:", dbText);

    res.json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.log(
      "RAZORPAY CREATE ORDER ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to create payment order"
    });
  }
});

// ===============================
// VERIFY RAZORPAY PAYMENT
// ===============================

app.post("/verify-payment", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment verification details are missing"
      });
    }

    // Create expected signature
    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(
        razorpay_order_id + "|" + razorpay_payment_id
      )
      .digest("hex");

    // Verify signature
    if (generatedSignature !== razorpay_signature) {
      console.log("RAZORPAY SIGNATURE INVALID");

      return res.status(400).json({
        success: false,
        message: "Payment verification failed"
      });
    }

    console.log("RAZORPAY SIGNATURE VERIFIED");

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    console.log(
      "RAZORPAY PAYMENT STATUS:",
      payment.status
    );

    // Update Supabase
    const dbResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(razorpay_order_id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          payment_status: payment.status,
          payment_id: razorpay_payment_id
        })
      }
    );

    const dbText = await dbResponse.text();

    console.log("DATABASE UPDATE:", dbText);

    res.json({
      success: true,
      paymentStatus: payment.status,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id
    });

  } catch (error) {
    console.log(
      "RAZORPAY VERIFY ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to verify payment"
    });
  }
});

// ===============================
// PAYMENT STATUS
// ===============================

app.get("/payment-status", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is missing"
      });
    }

    const order = await razorpay.orders.fetch(order_id);

    console.log(
      "RAZORPAY ORDER STATUS:",
      order.status
    );

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.log(
      "RAZORPAY STATUS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Unable to fetch payment status"
    });
  }
});

// ===============================
// SERVER
// ===============================

const PORT = 3000;

app.listen(PORT, () => {
  console.log(
    `BILL DESK server running at http://localhost:${PORT}`
  );
});
module.exports = app;
