const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Enforce ADMIN role for all routes in this router
router.use(requireAuth, requireRole('ADMIN'));

// Get System Overview Dashboard Metrics
router.get('/stats', async (req, res) => {
  try {
    const totalPatients = await prisma.user.count({ where: { role: 'PATIENT' } });
    const totalDoctors = await prisma.user.count({ where: { role: 'DOCTOR' } });
    const totalAppointments = await prisma.appointment.count();
    const activeHolds = await prisma.slotHold.count({ where: { expiresAt: { gt: new Date() } } });
    const pendingNotifications = await prisma.notificationLog.count({ where: { status: 'PENDING' } });
    const failedNotifications = await prisma.notificationLog.count({ where: { status: 'FAILED' } });

    const appointmentsByStatus = await prisma.appointment.groupBy({
      by: ['status'],
      _count: true,
    });

    res.json({
      totalPatients,
      totalDoctors,
      totalAppointments,
      activeHolds,
      pendingNotifications,
      failedNotifications,
      appointmentsByStatus,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

// Admin create new Doctor Profile & User Account
router.post('/doctors', async (req, res) => {
  try {
    const { name, email, password, specialization, bio, consultationFee, slotDurationMinutes, workingHoursStart, workingHoursEnd } = req.body;

    if (!name || !email || !password || !specialization) {
      return res.status(400).json({ error: 'Name, email, password, and specialization are required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'An account with this email address already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialization,
            bio: bio || 'Expert medical doctor.',
            consultationFee: consultationFee ? parseFloat(consultationFee) : 60.0,
            slotDurationMinutes: slotDurationMinutes ? parseInt(slotDurationMinutes) : 30,
            workingHoursStart: workingHoursStart || '09:00',
            workingHoursEnd: workingHoursEnd || '17:00',
          },
        },
      },
      include: { doctorProfile: true },
    });

    res.status(201).json({
      message: 'Doctor profile created successfully',
      doctor: user,
    });
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Failed to create doctor profile' });
  }
});

// Admin edit Doctor Profile
router.put('/doctors/:id', async (req, res) => {
  try {
    const doctorProfileId = req.params.id;
    const { specialization, bio, consultationFee, slotDurationMinutes, workingHoursStart, workingHoursEnd } = req.body;

    const updated = await prisma.doctorProfile.update({
      where: { id: doctorProfileId },
      data: {
        specialization,
        bio,
        consultationFee: consultationFee ? parseFloat(consultationFee) : undefined,
        slotDurationMinutes: slotDurationMinutes ? parseInt(slotDurationMinutes) : undefined,
        workingHoursStart,
        workingHoursEnd,
      },
    });

    res.json({ message: 'Doctor profile updated', doctorProfile: updated });
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Failed to update doctor profile' });
  }
});

// Admin delete Doctor Profile & User Account
router.delete('/doctors/:id', async (req, res) => {
  try {
    const doctorProfileId = req.params.id;

    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { id: doctorProfileId },
      include: { user: true },
    });

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    // Clean dependent records
    await prisma.prescription.deleteMany({ where: { appointment: { doctorProfileId } } });
    await prisma.appointment.deleteMany({ where: { doctorProfileId } });
    await prisma.slotHold.deleteMany({ where: { doctorProfileId } });
    await prisma.doctorLeave.deleteMany({ where: { doctorProfileId } });
    await prisma.doctorProfile.delete({ where: { id: doctorProfileId } });
    await prisma.user.delete({ where: { id: doctorProfile.userId } });

    res.json({ message: `Doctor profile for ${doctorProfile.user?.name || 'doctor'} removed successfully` });
  } catch (error) {
    console.error('Error deleting doctor:', error);
    res.status(500).json({ error: 'Failed to delete doctor profile' });
  }
});

// Get Notification logs
router.get('/notifications', async (req, res) => {
  try {
    const logs = await prisma.notificationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notification logs' });
  }
});

// Retry sending failed notification
router.post('/notifications/:id/retry', async (req, res) => {
  try {
    const id = req.params.id;
    const log = await prisma.notificationLog.findUnique({ where: { id } });

    if (!log) return res.status(404).json({ error: 'Log entry not found' });

    const success = await notificationService.sendEmail({
      recipientEmail: log.recipientEmail,
      recipientName: log.recipientName,
      type: log.type,
      subject: log.subject,
      content: log.content,
    });

    res.json({ success, message: success ? 'Notification re-sent successfully' : 'Retry failed' });
  } catch (error) {
    res.status(500).json({ error: 'Retry execution error' });
  }
});

module.exports = router;
