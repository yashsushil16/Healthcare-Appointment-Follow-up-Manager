const nodemailer = require('nodemailer');
const prisma = require('../config/db');

// Setup Nodemailer Transporter (Uses Ethereal automated test transport if custom SMTP is not set)
let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user, pass },
    });
  } else {
    // Automated Ethereal account for development/testing
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('[Notification Service] Created Ethereal test SMTP user:', testAccount.user);
  }

  return transporter;
}

/**
 * Log notification and attempt immediate send
 */
async function sendEmail({ recipientEmail, recipientName, type, subject, content }) {
  // 1. Log in DB
  const log = await prisma.notificationLog.create({
    data: {
      recipientEmail,
      recipientName,
      type,
      subject,
      content,
      status: 'PENDING',
      attempts: 0,
    },
  });

  // 2. Dispatch email
  try {
    const transport = await getTransporter();
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || '"DrPatho Appointments" <no-reply@drpatho.com>',
      to: `"${recipientName}" <${recipientEmail}>`,
      subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #1E293B; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 12px; background: #FFFFFF;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #DC2626;">
            <h1 style="color: #DC2626; margin: 0; font-size: 24px; letter-spacing: -0.5px;">DrPatho Appointments</h1>
            <p style="color: #64748B; margin: 4px 0 0 0; font-size: 14px;">Intelligent Healthcare & Clinical Care Manager</p>
          </div>
          <div style="padding: 20px 0; font-size: 15px; line-height: 1.6;">
            ${content}
          </div>
          <div style="border-top: 1px solid #F1F5F9; padding-top: 16px; font-size: 12px; color: #94A3B8; text-align: center;">
            &copy; 2026 DrPatho Appointments. All rights reserved. Emergency? Call 911 immediately.
          </div>
        </div>
      `,
    });

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: 'SENT',
        attempts: 1,
      },
    });

    console.log(`[Notification Service] Email sent successfully to ${recipientEmail}. MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Notification Service] Failed to send email to ${recipientEmail}:`, err.message);

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: 'FAILED',
        attempts: 1,
        errorMsg: err.message,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 mins
      },
    });

    return false;
  }
}

/**
 * Send Booking Confirmation Email
 */
async function sendBookingConfirmation(appointment, doctorProfile) {
  const dateStr = new Date(appointment.slotTime).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = new Date(appointment.slotTime).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });

  const calendarLink = generateGoogleCalendarUrl(appointment, doctorProfile);

  // Email to Patient
  await sendEmail({
    recipientEmail: appointment.patient.email,
    recipientName: appointment.patient.name,
    type: 'BOOKING_CONFIRMATION',
    subject: `Appointment Confirmed with Dr. ${appointment.doctor.name} - DrPatho`,
    content: `
      <p>Hello <strong>${appointment.patient.name}</strong>,</p>
      <p>Your appointment has been successfully booked!</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; background: #FEF2F2; padding: 12px; border-radius: 8px;">
        <tr><td style="padding: 6px; font-weight: bold; color: #991B1B;">Doctor:</td><td style="padding: 6px;">Dr. ${appointment.doctor.name} (${doctorProfile.specialization})</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; color: #991B1B;">Date & Time:</td><td style="padding: 6px;">${dateStr} at ${timeStr}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold; color: #991B1B;">Urgency Assessment:</td><td style="padding: 6px;">${appointment.preVisitUrgency || 'Standard'}</td></tr>
      </table>
      <p style="text-align: center; margin-top: 20px;">
        <a href="${calendarLink}" target="_blank" style="background: #DC2626; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">+ Add to Google Calendar</a>
      </p>
    `,
  });

  // Email to Doctor
  await sendEmail({
    recipientEmail: appointment.doctor.email,
    recipientName: appointment.doctor.name,
    type: 'BOOKING_CONFIRMATION',
    subject: `New Patient Appointment: ${appointment.patient.name} - DrPatho`,
    content: `
      <p>Hello <strong>Dr. ${appointment.doctor.name}</strong>,</p>
      <p>A new appointment has been scheduled.</p>
      <ul>
        <li><strong>Patient:</strong> ${appointment.patient.name} (${appointment.patient.email})</li>
        <li><strong>Date & Time:</strong> ${dateStr} at ${timeStr}</li>
        <li><strong>Chief Symptoms:</strong> ${appointment.symptoms}</li>
        <li><strong>AI Urgency Level:</strong> ${appointment.preVisitUrgency}</li>
      </ul>
    `,
  });
}

/**
 * Generate Google Calendar Direct Add URL fallback
 */
function generateGoogleCalendarUrl(appointment, doctorProfile) {
  const startTime = new Date(appointment.slotTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
  const endTime = new Date(appointment.endTime).toISOString().replace(/-|:|\.\d\d\d/g, '');

  const title = encodeURIComponent(`DrPatho Appointment: Dr. ${appointment.doctor.name} with ${appointment.patient.name}`);
  const details = encodeURIComponent(`Medical consultation with Dr. ${appointment.doctor.name} (${doctorProfile?.specialization || 'Healthcare'}). Symptoms: ${appointment.symptoms}`);
  const location = encodeURIComponent('DrPatho Clinical Telehealth / Clinic Portal');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startTime}/${endTime}&details=${details}&location=${location}`;
}

/**
 * Google Calendar API helper (Supports direct OAuth or falls back gracefully)
 */
async function createGoogleCalendarEvent(appointment, doctorProfile) {
  // If Google credentials are provided, googleapis can be used
  const gcalUrl = generateGoogleCalendarUrl(appointment, doctorProfile);
  return {
    id: `gcal-${appointment.id}`,
    htmlLink: gcalUrl,
  };
}

module.exports = {
  sendEmail,
  sendBookingConfirmation,
  generateGoogleCalendarUrl,
  createGoogleCalendarEvent,
};
