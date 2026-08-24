const prisma = require('../config/db');
const notificationService = require('./notificationService');

/**
 * Apply Doctor Leave and handle conflicting appointments automatically
 */
async function applyDoctorLeave(doctorProfileId, startDateStr, endDateStr, reason = 'Scheduled leave') {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { user: true },
  });

  if (!doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  const doctorUserId = doctorProfile.userId;

  // 1. Create Doctor Leave record
  const leave = await prisma.doctorLeave.create({
    data: {
      doctorId: doctorProfileId,
      startDate: startDateStr,
      endDate: endDateStr,
      reason,
    },
  });

  // Calculate start & end datetime bounds for collision detection
  const startBound = new Date(`${startDateStr}T00:00:00.000Z`);
  const endBound = new Date(`${endDateStr}T23:59:59.999Z`);

  // 2. Find affected appointments
  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctorUserId,
      slotTime: {
        gte: startBound,
        lte: endBound,
      },
      status: { in: ['CONFIRMED', 'PENDING'] },
    },
    include: {
      patient: true,
    },
  });

  // 3. Cancel affected appointments in batch
  if (affectedAppointments.length > 0) {
    await prisma.appointment.updateMany({
      where: {
        id: { in: affectedAppointments.map(a => a.id) },
      },
      data: {
        status: 'CANCELLED_DUE_TO_LEAVE',
      },
    });

    // 4. Notify all affected patients asynchronously
    for (const appt of affectedAppointments) {
      const dateStr = new Date(appt.slotTime).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      const timeStr = new Date(appt.slotTime).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
      });

      notificationService.sendEmail({
        recipientEmail: appt.patient.email,
        recipientName: appt.patient.name,
        type: 'LEAVE_NOTIFICATION',
        subject: `Appointment Update: Dr. ${doctorProfile.user.name} on Leave`,
        content: `
          <p>Hello <strong>${appt.patient.name}</strong>,</p>
          <p>We regret to inform you that your upcoming appointment scheduled for <strong>${dateStr} at ${timeStr}</strong> with Dr. ${doctorProfile.user.name} has been cancelled because the doctor is away on leave (${reason}).</p>
          <div style="background: #FEF2F2; padding: 12px; border-left: 4px solid #DC2626; border-radius: 4px; margin: 16px 0;">
            <strong>Next Steps:</strong> Please log into your <a href="http://localhost:3000" style="color: #DC2626; font-weight: bold;">DrPatho Appointments</a> portal to select another available date or book with another specialist.
          </div>
        `,
      }).catch(err => console.error(`[Leave Service] Error notifying patient ${appt.patient.email}:`, err.message));
    }
  }

  return {
    leave,
    affectedAppointmentsCount: affectedAppointments.length,
  };
}

module.exports = {
  applyDoctorLeave,
};
