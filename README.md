# 🏥 DrPatho Appointments - Healthcare Appointment & Follow-up Manager

**DrPatho Appointments** is a modern, full-stack healthcare appointment and clinical follow-up management platform. It features separate role-based portals for **Patients**, **Doctors**, and **Admins**, AI-powered pre-visit symptom triage and post-visit clinical summaries, double-booking prevention with a 5-minute slot hold mechanism, automated doctor leave conflict handling, daily medication reminders, and reliable email & Google Calendar integration.

---

## 🌐 Live Hosted Deployment Links

- **Frontend Application (Vercel)**: [https://healthcare-appointment-follow-up-ma-bice.vercel.app](https://healthcare-appointment-follow-up-ma-bice.vercel.app)
- **Backend API Service (Render)**: [https://healthcare-appointment-follow-up-manager-fmzs.onrender.com](https://healthcare-appointment-follow-up-manager-fmzs.onrender.com)
- **Source Code Repository (GitHub)**: [https://github.com/yashsushil16/Healthcare-Appointment-Follow-up-Manager](https://github.com/yashsushil16/Healthcare-Appointment-Follow-up-Manager)

---

## 🎨 Visual Design & Theme
- **Color Theme**: Clean, professional Light Medical Theme with **Medical Red** (`#DC2626` / `#EF4444`) on crisp white (`#FFFFFF`) and soft slate (`#FAFAFA`) surfaces.
- **Typography**: Google Font **Plus Jakarta Sans**.
- **Aesthetic Excellence**: Built following `high-end-visual-design` principles featuring **Double-Bezel (Doppelrand)** nested card enclosures, a floating glass navigation header, real-time 5-minute Slot Hold countdown timer, and soft glowing urgency level badges (Low / Medium / High).

---

## 🚀 Quick Setup & Local Execution Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Step 1: Install Dependencies
```bash
# Navigate to Source Code directory
cd "Source Code"

# Install Server Dependencies
cd server
npm install

# Install Client Dependencies
cd ../client
npm install
```

### Step 2: Set Up Environment Variables
Create a `.env` file in `Source Code/server` (or copy `.env.example`):
```env
PORT=5000
DATABASE_URL="file:./dev.db"
JWT_SECRET="drpatho_super_secret_jwt_key_2026_healthcare"

# Optional LLM API Key (OpenAI or Gemini). Smart built-in fallback runs if empty!
OPENAI_API_KEY=""

# Optional Email SMTP Settings (Uses Ethereal test account automatically if blank)
SMTP_HOST="smtp.ethereal.email"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""

# Optional Google Calendar OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

### Step 3: Initialize Database & Seed Demo Accounts
```bash
cd "Source Code/server"
npx prisma db push
npm run db:seed
```

### Step 4: Run the Application
In a terminal, start the Express backend server:
```bash
cd "Source Code/server"
npm start
```
*Backend API runs at: `http://localhost:5000`*

In a second terminal, start the React frontend dev server:
```bash
cd "Source Code/client"
npm run dev
```
*Frontend Portal runs at: `http://localhost:3000`*

*(Or build production assets via `npm run build` in `client` and serve everything directly from `http://localhost:5000`!)*

---

## 🔑 Pre-Configured Demo Login Accounts (Indian Profiles)

| Role | Name | Email | Password | Description |
|---|---|---|---|---|
| **Patient** | Aarav Mehta | `patient@drpatho.com` | `password123` | Book appointments, view 5-min slot lock, AI summaries |
| **Doctor** | Dr. Ananya Deshmukh | `ananya.deshmukh@drpatho.com` | `password123` | Senior Cardiologist: View pre-visit AI insights, complete visit, apply leave |
| **Admin** | Rajesh Sharma | `admin@drpatho.com` | `admin123` | System Administrator: Onboard doctors, system stats, notification retry logs |

*(One-click autofill buttons are also available on the Sign In modal in the application header!)*

---

## 🧠 LLM Prompts & Failure Graceful Fallback Guide

### 1. Pre-Visit AI Symptom Summary Prompt
```text
"Analyse these symptoms and return JSON with keys: urgency level ("Low" | "Medium" | "High"), chief complaint (string), and three suggested questions for the doctor. Symptoms: <symptoms>"
```

### 2. Post-Visit Patient-Friendly Summary Prompt
```text
"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Clinical Notes: <notes>. Prescribed Medications: <medications>"
```

### 3. Graceful Fallback Strategy
If `OPENAI_API_KEY` or `GEMINI_API_KEY` is omitted or API calls fail due to network timeouts, the system gracefully triggers built-in NLP-inspired rule triage algorithms (`fallbackPreVisitAnalysis` and `fallbackPostVisitAnalysis`). The platform **never breaks or fails a booking** due to an LLM provider outage.

---

## 📅 Google Calendar Setup Steps

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named **DrPatho Appointments**.
3. Enable the **Google Calendar API** under API & Services.
4. Create **OAuth 2.0 Credentials** (Authorized Redirect URI: `http://localhost:5000/api/auth/google/callback`).
5. Copy the Client ID & Secret into `server/.env`.
6. *Fallback*: Every booking email and patient appointment card includes a direct "+ Add to Google Calendar" web URL (`https://calendar.google.com/calendar/render?action=TEMPLATE...`), rendering calendar sync instantly functional without any API configuration required!

---

## 📊 Database Schema Overview (`Prisma + SQLite`)

- **`User`**: Account details (ID, name, email, passwordHash, role: `PATIENT` | `DOCTOR` | `ADMIN`).
- **`DoctorProfile`**: Specialization, bio, consultationFee, workingHoursStart/End, slotDurationMinutes.
- **`DoctorLeave`**: Scheduled leave date ranges (`startDate`, `endDate`, reason).
- **`SlotHold`**: 5-minute temporary slot locks (`doctorId`, `slotTime`, `patientId`, `expiresAt`).
- **`Appointment`**: `slotTime`, `status`, symptoms, `preVisitUrgency`, `preVisitChiefComplaint`, `postVisitNotes`, `postVisitSummary`.
- **`Prescription`**: Prescribed medications JSON array (`name`, `dosage`, `frequency`, `durationDays`).
- **`NotificationLog`**: Delivery retry queue (`recipientEmail`, `type`, `status`, `attempts`, `errorMsg`).

---

## 📡 REST API Reference

### Authentication
- `POST /api/auth/register` - Create user account.
- `POST /api/auth/login` - Authenticate and retrieve JWT token.
- `GET /api/auth/me` - Retrieve current session profile.

### Doctors & Availability
- `GET /api/doctors` - Directory of doctors with specialization search.
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD` - Compute real-time slots and hold statuses.
- `POST /api/doctors/leave` - Apply doctor leave (Auto-cancels conflicting appointments & notifies patients).

### Appointments & Slots
- `POST /api/appointments/hold` - Lock slot for 5 minutes (ACID transaction).
- `POST /api/appointments/book` - Confirm appointment with symptoms (Generates AI Pre-Visit summary).
- `GET /api/appointments/my-appointments` - User's appointments list.
- `POST /api/appointments/:id/complete` - Doctor submits clinical notes & prescription (Generates AI Post-Visit summary).
- `POST /api/appointments/:id/cancel` - Cancel appointment.

### Admin Operations
- `GET /api/admin/stats` - System overview metrics.
- `POST /api/admin/doctors` - Onboard new doctor profile.
- `GET /api/admin/notifications` - Notification delivery audit log.
- `POST /api/admin/notifications/:id/retry` - Manually trigger notification retry.
