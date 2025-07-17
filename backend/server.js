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

dotenv.config();

const app = express();

// Middleware
// CORS configuration for testing and production
app.use(cors());

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

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

const DBPassword = encodeURIComponent('Dexter_#254');
const PORT = process.env.PORT || 5000;
const MONGO_URI = `mongodb+srv://ecommerce:${DBPassword}@cluster0.joccydy.mongodb.net/`;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
