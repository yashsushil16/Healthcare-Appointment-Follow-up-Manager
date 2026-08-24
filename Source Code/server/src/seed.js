const bcrypt = require('bcryptjs');
const prisma = require('./config/db');

async function seed() {
  console.log('[Seed] Seeding DrPatho Appointments database with Indian profiles & INR currency...');

  // Clean existing tables
  await prisma.prescription.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.slotHold.deleteMany();
  await prisma.doctorLeave.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.user.deleteMany();

  const defaultPasswordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 1. Create Admin Account
  const admin = await prisma.user.create({
    data: {
      name: 'Rajesh Sharma (Admin)',
      email: 'admin@drpatho.com',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  });
  console.log(`[Seed] Created Admin user: ${admin.email}`);

  // 2. Create Demo Patient Account
  const patient = await prisma.user.create({
    data: {
      name: 'Aarav Mehta',
      email: 'patient@drpatho.com',
      passwordHash: defaultPasswordHash,
      role: 'PATIENT',
    },
  });
  console.log(`[Seed] Created Patient user: ${patient.email}`);

  // 3. Create Doctors & Profiles (Indian Specialists)
  const doctorsData = [
    {
      name: 'Dr. Ananya Deshmukh',
      email: 'ananya.deshmukh@drpatho.com',
      specialization: 'Cardiology',
      bio: 'Senior Clinical Cardiologist with over 14 years of experience at AIIMS. Specialist in preventive cardiology, ECG interpretation, and hypertension management.',
      consultationFee: 1200.0,
      slotDurationMinutes: 30,
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
    },
    {
      name: 'Dr. Vikramaditya Reddy',
      email: 'vikram.reddy@drpatho.com',
      specialization: 'Dermatology',
      bio: 'Consultant Dermatologist & Trichologist specializing in clinical dermatology, skin health, and diagnostic screenings.',
      consultationFee: 950.0,
      slotDurationMinutes: 30,
      workingHoursStart: '10:00',
      workingHoursEnd: '16:00',
    },
    {
      name: 'Dr. Priyadarshini Iyer',
      email: 'priya.iyer@drpatho.com',
      specialization: 'General Medicine',
      bio: 'Senior Physician & Diabetologist passionate about integrative healthcare, metabolic disease screening, and family wellness.',
      consultationFee: 750.0,
      slotDurationMinutes: 30,
      workingHoursStart: '08:30',
      workingHoursEnd: '16:30',
    },
    {
      name: 'Dr. Kabir Banerjee',
      email: 'kabir.banerjee@drpatho.com',
      specialization: 'Pediatrics',
      bio: 'Senior Pediatrician providing compassionate child health care, growth tracking, and immunization management.',
      consultationFee: 850.0,
      slotDurationMinutes: 30,
      workingHoursStart: '09:00',
      workingHoursEnd: '15:00',
    },
  ];

  for (const doc of doctorsData) {
    const user = await prisma.user.create({
      data: {
        name: doc.name,
        email: doc.email,
        passwordHash: defaultPasswordHash,
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialization: doc.specialization,
            bio: doc.bio,
            consultationFee: doc.consultationFee,
            slotDurationMinutes: doc.slotDurationMinutes,
            workingHoursStart: doc.workingHoursStart,
            workingHoursEnd: doc.workingHoursEnd,
          },
        },
      },
      include: { doctorProfile: true },
    });
    console.log(`[Seed] Created Doctor: ${user.name} (${doc.specialization})`);
  }

  console.log('[Seed] Database seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('[Seed] Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
