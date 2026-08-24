const prisma = require('../config/db');
const llmService = require('./llmService');
const notificationService = require('./notificationService');

/**
 * Clean up expired slot holds (TTL < current time)
 */
async function cleanupExpiredHolds() {
  await prisma.slotHold.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

/**
 * Get available time slots for a doctor on a specific date (YYYY-MM-DD)
 */
async function getDoctorSlots(doctorId, dateStr, currentUserId = null) {
  await cleanupExpiredHolds();

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  // Check if doctor is on leave for this date
  const leave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId: doctorId,
      startDate: { lte: dateStr },
      endDate: { gte: dateStr },
    },
  });

  if (leave) {
    return {
      date: dateStr,
      isOnLeave: true,
      leaveReason: leave.reason || 'Doctor is on scheduled leave',
      slots: [],
    };
  }

  // Parse working hours & slot duration
  const [startHour, startMin] = doctorProfile.workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = doctorProfile.workingHoursEnd.split(':').map(Number);
  const slotMinutes = doctorProfile.slotDurationMinutes || 30;

  const [year, month, day] = dateStr.split('-').map(Number);
  const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

  // Fetch existing appointments for the day
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctorProfile.userId,
      slotTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: { in: ['CONFIRMED', 'COMPLETED'] },
    },
  });

  // Fetch existing active slot holds for the day
  const activeHolds = await prisma.slotHold.findMany({
    where: {
      doctorId: doctorProfile.userId,
      slotTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
      expiresAt: { gt: new Date() },
    },
  });

  const bookedSlotTimes = new Set(existingAppointments.map(a => new Date(a.slotTime).toISOString()));
  const holdMap = new Map();
  activeHolds.forEach(h => {
    holdMap.set(new Date(h.slotTime).toISOString(), h);
  });

  // Generate candidate slots
  const slots = [];
  let currentTime = new Date(year, month - 1, day, startHour, startMin, 0, 0);
  const endTimeLimit = new Date(year, month - 1, day, endHour, endMin, 0, 0);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  while (currentTime < endTimeLimit) {
    const slotIso = currentTime.toISOString();
    const slotEndTime = new Date(currentTime.getTime() + slotMinutes * 60000);

    let status = 'AVAILABLE';
    let holdInfo = null;

    if (startOfDay < todayStart) {
      status = 'PAST';
    } else if (bookedSlotTimes.has(slotIso)) {
      status = 'BOOKED';
    } else if (holdMap.has(slotIso)) {
      const hold = holdMap.get(slotIso);
      if (currentUserId && hold.patientId === currentUserId) {
        status = 'HELD_BY_YOU';
        holdInfo = { expiresAt: hold.expiresAt };
      } else {
        status = 'HELD_BY_OTHER';
      }
    }

    slots.push({
      slotTime: slotIso,
      endTime: slotEndTime.toISOString(),
      formattedTime: currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status,
      holdInfo,
    });

    currentTime = new Date(currentTime.getTime() + slotMinutes * 60000);
  }

  return {
    date: dateStr,
    isOnLeave: false,
    doctor: {
      id: doctorProfile.id,
      name: doctorProfile.user.name,
      specialization: doctorProfile.specialization,
      consultationFee: doctorProfile.consultationFee,
    },
    slots,
  };
}

/**
 * Hold Slot Mechanism (5-minute TTL)
 * Prevents race conditions using database unique constraint + transaction lock
 */
async function holdSlot(patientId, doctorProfileId, slotTimeIso) {
  await cleanupExpiredHolds();

  const slotTime = new Date(slotTimeIso);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
  });

  if (!doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  const doctorUserId = doctorProfile.userId;

  // Execute in isolated database transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Check if slot is already booked
    const existingBooking = await tx.appointment.findFirst({
      where: {
        doctorId: doctorUserId,
        slotTime: slotTime,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    });

    if (existingBooking) {
      throw new Error('This slot has already been booked by another patient.');
    }

    // 2. Check if slot is held by someone else
    const existingHold = await tx.slotHold.findUnique({
      where: {
        doctorId_slotTime: {
          doctorId: doctorUserId,
          slotTime: slotTime,
        },
      },
    });

    if (existingHold) {
      if (existingHold.patientId === patientId && existingHold.expiresAt > new Date()) {
        // Refresh existing hold for the same user
        const updatedHold = await tx.slotHold.update({
          where: { id: existingHold.id },
          data: { expiresAt },
        });
        return { message: 'Slot hold refreshed', hold: updatedHold };
      } else if (existingHold.expiresAt > new Date()) {
        throw new Error('Slot is currently held by another patient. Please select another slot.');
      } else {
        // Expired hold, delete it
        await tx.slotHold.delete({ where: { id: existingHold.id } });
      }
    }

    // 3. Insert new Slot Hold
    const hold = await tx.slotHold.create({
      data: {
        doctorId: doctorUserId,
        slotTime,
        patientId,
        expiresAt,
      },
    });

    return {
      message: 'Slot locked for 5 minutes',
      holdId: hold.id,
      expiresAt: hold.expiresAt,
    };
  });
}

/**
 * Confirm & Book Appointment safely
 */
async function bookAppointment(patientId, doctorProfileId, slotTimeIso, symptoms) {
  const slotTime = new Date(slotTimeIso);

  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { id: doctorProfileId },
    include: { user: true },
  });

  if (!doctorProfile) {
    throw new Error('Doctor not found');
  }

  const doctorUserId = doctorProfile.userId;
  const slotMinutes = doctorProfile.slotDurationMinutes || 30;
  const endTime = new Date(slotTime.getTime() + slotMinutes * 60000);

  // Generate Pre-Visit LLM Summary
  const preVisit = await llmService.generatePreVisitSummary(symptoms);

  // Perform Booking inside Transaction
  const appointment = await prisma.$transaction(async (tx) => {
    // 1. Check double booking
    const existingBooking = await tx.appointment.findFirst({
      where: {
        doctorId: doctorUserId,
        slotTime,
        status: { in: ['CONFIRMED', 'COMPLETED'] },
      },
    });

    if (existingBooking) {
      throw new Error('Slot conflict: This slot was booked moments ago by another patient.');
    }

    // 2. Remove patient hold
    await tx.slotHold.deleteMany({
      where: {
        doctorId: doctorUserId,
        slotTime,
      },
    });

    // 3. Create Appointment record
    const newAppointment = await tx.appointment.create({
      data: {
        patientId,
        doctorId: doctorUserId,
        slotTime,
        endTime,
        status: 'CONFIRMED',
        symptoms,
        preVisitUrgency: preVisit.urgency,
        preVisitChiefComplaint: preVisit.chiefComplaint,
        preVisitSuggestedQuestions: JSON.stringify(preVisit.suggestedQuestions),
      },
      include: {
        patient: true,
        doctor: true,
      },
    });

    return newAppointment;
  });

  // Trigger Notifications & Calendar async
  try {
    const calendarEvent = await notificationService.createGoogleCalendarEvent(appointment, doctorProfile);
    if (calendarEvent && calendarEvent.id) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { googleCalendarEventId: calendarEvent.id },
      });
    }

    await notificationService.sendBookingConfirmation(appointment, doctorProfile);
  } catch (err) {
    console.error('Async notification trigger error:', err.message);
  }

  return appointment;
}

module.exports = {
  getDoctorSlots,
  holdSlot,
  bookAppointment,
  cleanupExpiredHolds,
};
