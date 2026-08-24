const express = require('express');
const prisma = require('../config/db');
const slotService = require('../services/slotService');
const llmService = require('../services/llmService');
const notificationService = require('../services/notificationService');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// 1. Hold a slot (5-minute TTL lock)
router.post('/hold', requireAuth, requireRole('PATIENT'), async (req, res) => {
  try {
    const { doctorProfileId, slotTime } = req.body;
    const patientId = req.user.id;

    if (!doctorProfileId || !slotTime) {
      return res.status(400).json({ error: 'Doctor ID and slot time are required' });
    }

    const result = await slotService.holdSlot(patientId, doctorProfileId, slotTime);
    res.json(result);
  } catch (error) {
    console.error('Slot hold error:', error.message);
    res.status(409).json({ error: error.message });
  }
});

// 2. Book appointment with symptoms & AI pre-visit summary
router.post('/book', requireAuth, requireRole('PATIENT'), async (req, res) => {
  try {
    const { doctorProfileId, slotTime, symptoms } = req.body;
    const patientId = req.user.id;

    if (!doctorProfileId || !slotTime || !symptoms) {
      return res.status(400).json({ error: 'Doctor ID, slot time, and symptoms are required' });
    }

    const appointment = await slotService.bookAppointment(patientId, doctorProfileId, slotTime, symptoms);
    res.status(201).json({
      message: 'Appointment booked successfully!',
      appointment,
    });
  } catch (error) {
    console.error('Booking error:', error.message);
    res.status(409).json({ error: error.message });
  }
});

// 3. Get Appointments (For current logged-in user: Patient or Doctor)
router.get('/my-appointments', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let appointments = [];
    if (role === 'PATIENT') {
      appointments = await prisma.appointment.findMany({
        where: { patientId: userId },
        include: {
          doctor: {
            select: { id: true, name: true, email: true, doctorProfile: true },
          },
          prescription: true,
        },
        orderBy: { slotTime: 'asc' },
      });
    } else if (role === 'DOCTOR') {
      appointments = await prisma.appointment.findMany({
        where: { doctorId: userId },
        include: {
          patient: {
            select: { id: true, name: true, email: true },
          },
          prescription: true,
        },
        orderBy: { slotTime: 'asc' },
      });
    } else if (role === 'ADMIN') {
      appointments = await prisma.appointment.findMany({
        include: {
          patient: true,
          doctor: true,
          prescription: true,
        },
        orderBy: { slotTime: 'desc' },
      });
    }

    // Parse JSON string fields for client consumption
    const formatted = appointments.map(a => ({
      ...a,
      preVisitSuggestedQuestions: a.preVisitSuggestedQuestions ? JSON.parse(a.preVisitSuggestedQuestions) : [],
      postVisitMedicationSchedule: a.postVisitMedicationSchedule ? JSON.parse(a.postVisitMedicationSchedule) : [],
      postVisitFollowUpSteps: a.postVisitFollowUpSteps ? JSON.parse(a.postVisitFollowUpSteps) : [],
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// 4. Doctor completes visit: Submits clinical notes & prescription, generates LLM post-visit summary
router.post('/:id/complete', requireAuth, requireRole('DOCTOR'), async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { clinicalNotes, medications } = req.body; // medications: [{ name, dosage, frequency, durationDays }]

    if (!clinicalNotes) {
      return res.status(400).json({ error: 'Clinical notes are required to complete visit' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.doctorId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to modify this appointment' });
    }

    // Generate LLM Post-Visit Patient-Friendly Summary
    const postVisitAI = await llmService.generatePostVisitSummary(clinicalNotes, medications || []);

    // Save Post-Visit Summary & Prescription
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'COMPLETED',
        postVisitNotes: clinicalNotes,
        postVisitSummary: postVisitAI.summary,
        postVisitMedicationSchedule: JSON.stringify(postVisitAI.medicationSchedule),
        postVisitFollowUpSteps: JSON.stringify(postVisitAI.followUpSteps),
      },
    });

    if (medications && medications.length > 0) {
      await prisma.prescription.upsert({
        where: { appointmentId: appointmentId },
        update: {
          medications: JSON.stringify(medications),
        },
        create: {
          appointmentId,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          medications: JSON.stringify(medications),
        },
      });
    }

    // Notify patient of completion & post-visit summary
    notificationService.sendEmail({
      recipientEmail: appointment.patient.email,
      recipientName: appointment.patient.name,
      type: 'BOOKING_CONFIRMATION',
      subject: `Post-Visit Summary & Consultation Notes - DrPatho`,
      content: `
        <p>Hello <strong>${appointment.patient.name}</strong>,</p>
        <p>Dr. ${appointment.doctor.name} has finalized your consultation summary.</p>
        <div style="background: #F8FAFC; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top:0; color: #DC2626;">Patient-Friendly Summary</h3>
          <p>${postVisitAI.summary}</p>
        </div>
        <p>Log in to <a href="http://localhost:3000" style="color:#DC2626; font-weight:bold;">DrPatho Appointments</a> to view full prescription details and follow-up steps.</p>
      `,
    }).catch(e => console.error('Error sending post-visit email:', e.message));

    res.json({
      message: 'Visit completed and post-visit summary generated!',
      appointment: updatedAppointment,
      postVisitSummary: postVisitAI,
    });
  } catch (error) {
    console.error('Error completing visit:', error);
    res.status(500).json({ error: 'Failed to submit post-visit notes' });
  }
});

// 5. Cancel appointment
router.post('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const appointmentId = req.params.id;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify ownership
    if (req.user.role === 'PATIENT' && appointment.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (req.user.role === 'DOCTOR' && appointment.doctorId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELLED' },
    });

    // Send cancellation notifications
    notificationService.sendEmail({
      recipientEmail: appointment.patient.email,
      recipientName: appointment.patient.name,
      type: 'CANCELLATION',
      subject: `Appointment Cancelled - DrPatho`,
      content: `<p>Hello ${appointment.patient.name}, your appointment with Dr. ${appointment.doctor.name} has been cancelled.</p>`,
    }).catch(e => console.error('Cancellation email error:', e.message));

    res.json({ message: 'Appointment cancelled', appointment: updated });
  } catch (error) {
    console.error('Cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

module.exports = router;
