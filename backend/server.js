const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const dotenv = require('dotenv');
const serviceRoutes = require('./routes/services');
const serviceViewRoutes = require('./routes/serviceView');
const contactRouter = require('./routes/contact');
const blogsRouter = require('./routes/blogs');
const appointmentsRouter = require('./routes/appointments');
const path = require('path');
const mpesaRoutes = require('./routes/mpesa');
const axios = require('axios');

dotenv.config();

const app = express();

// Middleware
// CORS configuration for testing and production
app.use(cors({
  origin: [
    'http://localhost:3000', // Frontend dev server
    'http://localhost:8080', // Added for frontend dev server
    'https://themabinti-com2.onrender.com/',
    'https://themabinti-com2-1.onrender.com',
    'https://083f15da7f3d.ngrok-free.app', // Ngrok for testing
    process.env.FRONTEND_URL // Production frontend (set in .env)
  ].filter(Boolean),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, '../themabinti.com/build')));

// Routes
app.use('/api', authRoutes);
app.use('/api/subcategory', require('./routes/subcategory'));
app.use('/api/services', serviceRoutes);
app.use('/api/service', serviceViewRoutes);
app.use('/api/contact', contactRouter);
app.use('/api/blogs', blogsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/mpesa', mpesaRoutes);

/**app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../themabinti.com/build', 'index.html')); // Adjust path if needed
});
**/


const DBPassword = encodeURIComponent('Dexter_#254')


// Environment variables (hardcoded)
const PORT = process.env.PORT || 5000;
MONGO_URI=`mongodb+srv://ecommerce:${DBPassword}@cluster0.joccydy.mongodb.net/`

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


const MPESA_URLS = {
  oauth: process.env.MPESA_OAUTH_URL || 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
  stkpush: process.env.MPESA_STKPUSH_URL || 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
};

// Token caching
let cachedToken = null;
let tokenExpiry = null;

const getAccessToken = async () => {
  if (cachedToken && tokenExpiry > Date.now()) {
    console.log('Using cached access token');
    return cachedToken;
  }

  const auth = Buffer.from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`).toString('base64');
  console.log('OAuth request:', { url: MPESA_URLS.oauth, authHeader: `Basic ${auth}` });
  try {
    const response = await axios.get(MPESA_URLS.oauth, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 15000
    });
    console.log("RESPONSE", response.data);
    cachedToken = response.data.access_token;
    tokenExpiry = Date.now() + (parseInt(response.data.expires_in) - 300) * 1000; // Refresh 5 min early
    console.log('New access token:', cachedToken);
    return cachedToken;
  } catch (error) {
    console.error('Error getting access token:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
};

const generateToken = async (req, res, next) => {

  console.log("KEY", {ConsumerKey, ConsumerSecret})

  const auth = Buffer.from(`${ConsumerKey}:${ConsumerSecret}`).toString(
      "base64"
  );

  try {
      const authresponse = await fetch(auth_link, {
          method: "GET",
          headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json",
          },
      });

      if (!authresponse.ok) {
          throw new Error(
              `Auth request from safaricom failed with status ${authresponse.status}`
          );
      }

      const data = await authresponse.json();

      console.log("DATA", data);

      const accessToken2 = data.access_token;

      console.log("ACCESS TOKEN", accessToken2);


      return accessToken2;
  } catch (err) {
      console.error("Error generating auth token:", err.message);
      const error = new Error(`Error generating auth token: ${err.message}`);
      error.status = 400;
      return next(error);
  }
}; 


// STK Push endpoint
app.post('/stkpush', async (req, res) => {
  const { phoneNumber, amount } = req.body;

  if (!/^254[17][0-9]{8}$/.test(phoneNumber)) {
    return res.status(400).json({ error: 'Invalid phone number format. Use 2547XXXXXXXX' });
  }
  if (!Number.isInteger(parseInt(amount)) || parseInt(amount) <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive integer' });
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password = Buffer.from(`${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`).toString('base64');

  try {
    const accessToken = await getAccessToken();
    console.log("ACCESS TOKEN", accessToken);
    const payload = {
      BusinessShortCode: process.env.SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerBuyGoodsOnline',
      Amount: parseInt(amount),
      PartyA: phoneNumber,
      PartyB: process.env.TILL_NUMBER,
      PhoneNumber: phoneNumber,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: 'themabinti.com',
      TransactionDesc: 'Payment to themabinti.com'
    };
    console.log('STK Push payload:', payload);
    console.log('The access token to be pushed is:', accessToken);

    const response = await axios.post(MPESA_URLS.stkpush, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    console.log('STK Push response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Error initiating STK Push:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({
      error: 'Failed to initiate payment',
      details: error.response?.data || error.message
    });
  }
});

// In-memory store for payment status
const paymentStatusStore = {};

// Callback endpoint
app.post('/callback', (req, res) => {
  console.log('Raw callback received:', req.body);
  
  try {
    const result = req.body;
    if (!result.Body?.stkCallback) {
      console.log('Invalid callback format - missing stkCallback');
      return res.status(400).json({ error: 'Invalid callback format' });
    }

    const callback = result.Body.stkCallback;
    console.log('Callback details:', {
      ResultCode: callback.ResultCode,
      ResultDesc: callback.ResultDesc,
      CallbackMetadata: callback.CallbackMetadata
    });

    if (callback.ResultCode === 0) {
      const metadata = callback.CallbackMetadata;
      if (!metadata || !metadata.Item) {
        console.log('Successful payment but missing metadata');
        return res.status(400).json({ error: 'Missing metadata' });
      }

      const paymentData = {
        amount: metadata.Item.find(i => i.Name === 'Amount')?.Value,
        mpesaReceiptNumber: metadata.Item.find(i => i.Name === 'MpesaReceiptNumber')?.Value,
        phoneNumber: metadata.Item.find(i => i.Name === 'PhoneNumber')?.Value,
        transactionDate: metadata.Item.find(i => i.Name === 'TransactionDate')?.Value
      };

      console.log('Payment successful:', paymentData);
      
      if (paymentData.phoneNumber) {
        paymentStatusStore[paymentData.phoneNumber] = {
          status: 'success',
          ...paymentData,
          timestamp: new Date().toISOString()
        };
      }
    } else {
      console.log('Payment failed:', callback.ResultDesc);
      const phoneNumber = callback.CallbackMetadata?.Item?.find(i => i.Name === 'PhoneNumber')?.Value;
      if (phoneNumber) {
        paymentStatusStore[phoneNumber] = {
          status: 'failed',
          reason: callback.ResultDesc,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    res.status(200).json({ status: 'Callback processed successfully' });
  } catch (error) {
    console.error('Error processing callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to check payment status by phone number
app.get('/payment-status', (req, res) => {
  const { phone } = req.query;
  console.log(`Checking payment status for phone: ${phone}`);
  
  if (!phone) {
    console.log('No phone number provided');
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const status = paymentStatusStore[phone];
  console.log(`Current status for ${phone}:`, status || 'pending');
  
  if (!status) {
    return res.json({ 
      status: 'pending',
      message: 'No payment record found for this number'
    });
  }
  
  res.json(status);
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});




