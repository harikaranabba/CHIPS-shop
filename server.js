const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

console.log("APP ID loaded:", !!process.env.CASHFREE_APP_ID);
console.log("SECRET loaded:", !!process.env.CASHFREE_SECRET_KEY);
console.log("SUPABASE URL loaded:", !!process.env.SUPABASE_URL);
console.log("SUPABASE KEY loaded:", !!process.env.SUPABASE_KEY);


console.log("APP ID (masked):", process.env.CASHFREE_APP_ID?.slice(0,4) + "..." + process.env.CASHFREE_APP_ID?.slice(-4));
console.log("APP ID length:", process.env.CASHFREE_APP_ID?.length);
console.log("SECRET length:", process.env.CASHFREE_SECRET_KEY?.length);

const { Cashfree, CFEnvironment } = require("cashfree-pg");

const app = express();

app.use(cors());
app.use(express.json());
const path = require("path");

app.use(express.static(path.join(__dirname, "website")));

const cashfree = new Cashfree(
  CFEnvironment.SANDBOX,
  process.env.CASHFREE_APP_ID,
  process.env.CASHFREE_SECRET_KEY
);

app.post("/create-order", async (req, res) => {
  try {
    console.log("CREATE ORDER BODY:", req.body);
    const { amount, phone, product, quantity, unit } = req.body;

    const orderId = "chips_" + Date.now();

    const request = {
      order_amount: Number(Number(amount).toFixed(2)),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: "customer_" + Date.now(),
        customer_phone: phone
      },
      order_meta: {
        return_url: `https://sri-ram-hot-chips.vercel.app/payment.html?order_id=${encodeURIComponent(orderId)}`
      }
    };

    const response = await cashfree.PGCreateOrder(request);

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
          order_id: response.data.order_id,
          product: product,
          amount: Number(amount),
          quantity: quantity,
          unit: unit,
          phone: phone,
          payment_session_id: response.data.payment_session_id
        })
      }
    );

    const dbText = await dbResponse.text();

    console.log("SUPABASE STATUS:", dbResponse.status);
    console.log("SUPABASE RESPONSE:", dbText);




    res.json({
      success: true,
      orderId: response.data.order_id,
      paymentSessionId: response.data.payment_session_id
    });

  } catch (error) {
    console.log("FULL CASHFREE ERROR:", error.response?.data || error);

    res.status(500).json({
      success: false,
      message: error.response?.data?.message || "Unable to create payment order"
    });
  }
});

const PORT = 3000;
app.get("/payment-status", async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is missing"
      });
    }

    const response = await cashfree.PGFetchOrder(order_id);

    console.log("CASHFREE STATUS:", response.data.order_status);

    const dbResponse = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}`,
      {
        method: "PATCH",
        headers: {
          apikey: process.env.SUPABASE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          payment_status: response.data.order_status
        })
      }
    );

    const dbText = await dbResponse.text();

    console.log("PAYMENT STATUS:", response.data.order_status);
    console.log("DATABASE UPDATE:", dbText);

    res.json({
      success: true,
      order: response.data
    });

  } catch (error) {
    console.log(
      "CASHFREE STATUS ERROR:",
      error.response?.data || error
    );

    res.status(500).json({
      success: false,
      message: "Unable to fetch payment status"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


