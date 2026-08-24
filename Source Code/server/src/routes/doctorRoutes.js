const express = require('express');
const prisma = require('../config/db');
const slotService = require('../services/slotService');
const leaveService = require('../services/leaveService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { seed } = require('../seed');

const router = express.Router();

// Public: Get all active doctors with search/specialization filters
router.get('/', async (req, res) => {
  try {
    const { specialization, query } = req.query;

    // Guarantee DB is populated with demo doctors if count is 0
    let count = await prisma.doctorProfile.count();
    if (count === 0) {
      console.log('[Doctor Route] No doctors found in DB. Executing auto-seed...');
      await seed(true);
    }

    const where = {};
    if (specialization && specialization !== 'ALL') {
      where.specialization = specialization;
    }
    if (query) {
      where.OR = [
        { specialization: { contains: query } },
        { user: { name: { contains: query } } },
      ];
    }

    const doctors = await prisma.doctorProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        leaves: true,
      },
    });

    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to fetch doctor profiles' });
  }
});

// Get available slots for a specific doctor on a given date (YYYY-MM-DD)
router.get('/:id/slots', async (req, res) => {
  try {
    const { date } = req.query;
    const doctorProfileId = req.params.id;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter (YYYY-MM-DD) is required' });
    }

    let currentUserId = null;
    if (req.headers.authorization) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        currentUserId = decoded.userId;
      } catch (e) {
        // Ignore unauthenticated slot queries
      }
    }

    const result = await slotService.getDoctorSlots(doctorProfileId, date, currentUserId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching slots:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// Doctor: Apply for Leave
router.post('/leave', requireAuth, requireRole('DOCTOR', 'ADMIN'), async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    let doctorProfileId;

    if (req.user.role === 'DOCTOR') {
      if (!req.user.doctorProfile) {
        return res.status(400).json({ error: 'Doctor profile missing' });
      }
      doctorProfileId = req.user.doctorProfile.id;
    } else {
      doctorProfileId = req.body.doctorProfileId;
    }

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const result = await leaveService.applyDoctorLeave(doctorProfileId, startDate, endDate, reason);
    res.json({
      message: 'Doctor leave applied successfully',
      leave: result.leave,
      affectedAppointmentsCount: result.affectedAppointmentsCount,
    });
  } catch (error) {
    console.error('Doctor leave application error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
