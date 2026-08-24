const cron = require('node-cron');
const prisma = require('../config/db');
const notificationService = require('./notificationService');

/**
 * Initialize background cron tasks
 */
function initSchedulers() {
  console.log('[Cron Engine] Initializing background reminder & retry schedulers...');

  // 1. Every 15 minutes: Check and retry failed email notifications
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processFailedNotificationRetries();
    } catch (err) {
      console.error('[Cron Engine] Failed notification retry job error:', err.message);
    }
  });

  // 2. Daily at 08:00 AM: Process daily medication reminders based on active prescriptions
  cron.schedule('0 8 * * *', async () => {
    try {
      await processMedicationReminders();
    } catch (err) {
      console.error('[Cron Engine] Medication reminder job error:', err.message);
    }
  });

  // 3. Every hour: Clean up expired slot holds
  cron.schedule('0 * * * *', async () => {
    try {
      const deleted = await prisma.slotHold.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      if (deleted.count > 0) {
        console.log(`[Cron Engine] Cleaned up ${deleted.count} expired slot holds.`);
      }
    } catch (err) {
      console.error('[Cron Engine] Hold cleanup error:', err.message);
    }
  });
}

/**
 * Process notification retries for failed emails with exponential backoff
 */
async function processFailedNotificationRetries() {
  const now = new Date();
  const pendingRetries = await prisma.notificationLog.findMany({
    where: {
      status: 'FAILED',
      attempts: { lt: 3 },
      OR: [
        { nextRetryAt: { lte: now } },
        { nextRetryAt: null },
      ],
    },
    take: 10,
  });

  if (pendingRetries.length === 0) return;

  console.log(`[Cron Engine] Retrying ${pendingRetries.length} failed notifications...`);

  for (const log of pendingRetries) {
    try {
      await notificationService.sendEmail({
        recipientEmail: log.recipientEmail,
        recipientName: log.recipientName,
        type: log.type,
        subject: log.subject,
        content: log.content,
      });
    } catch (err) {
      const nextAttempt = log.attempts + 1;
      const backoffMinutes = Math.pow(2, nextAttempt) * 5; // 10 min, 20 min backoff
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          attempts: nextAttempt,
          status: nextAttempt >= log.maxAttempts ? 'FAILED' : 'PENDING',
          errorMsg: err.message,
          nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
        },
      });
    }
  }
}

/**
 * Scan active prescriptions and send daily medication reminders
 */
async function processMedicationReminders() {
  const activePrescriptions = await prisma.prescription.findMany({
    include: {
      appointment: {
        include: {
          patient: true,
          doctor: true,
        },
      },
    },
  });

  for (const rx of activePrescriptions) {
    try {
      const medications = JSON.parse(rx.medications || '[]');
      if (medications.length === 0) continue;

      const medListHtml = medications
        .map(m => `<li><strong>${m.name}</strong> (${m.dosage}) - ${m.frequency || 'Daily'}</li>`)
        .join('');

      await notificationService.sendEmail({
        recipientEmail: rx.appointment.patient.email,
        recipientName: rx.appointment.patient.name,
        type: 'MEDICATION_REMINDER',
        subject: `Daily Medication Reminder - DrPatho`,
        content: `
          <p>Hello <strong>${rx.appointment.patient.name}</strong>,</p>
          <p>This is your daily DrPatho medication reminder. Please make sure to take your prescribed doses as scheduled:</p>
          <ul>${medListHtml}</ul>
          <p>If you experience any unusual symptoms or side effects, please contact your care team.</p>
        `,
      });
    } catch (err) {
      console.error(`[Cron Engine] Error processing medication reminder for Rx ID ${rx.id}:`, err.message);
    }
  }
}

module.exports = {
  initSchedulers,
  processFailedNotificationRetries,
  processMedicationReminders,
};
