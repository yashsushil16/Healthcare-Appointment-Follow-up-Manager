require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { initSchedulers } = require('./services/reminderScheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// Serve static client bundle if built
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Healthcheck Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'DrPatho Appointments Backend',
    timestamp: new Date().toISOString(),
  });
});

// Start Background Schedulers (Medication reminders, notification retries, slot cleanup)
initSchedulers();

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Global Error]:', err.stack);
  res.status(500).json({ error: err.message || 'An unexpected server error occurred' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  DrPatho Appointments Server is running on port ${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});
