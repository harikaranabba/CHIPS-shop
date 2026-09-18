module.exports = (req, res) => {
  res.json({
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_KEY: !!process.env.SUPABASE_KEY,
    RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: !!process.env.RAZORPAY_KEY_SECRET
  });
};