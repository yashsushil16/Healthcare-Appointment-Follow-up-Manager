import React, { useState, useEffect } from 'react';
import { Search, Calendar, Clock, AlertTriangle, CheckCircle2, ShieldCheck, Stethoscope, ArrowRight, X, ExternalLink, Pill, Sparkles } from 'lucide-react';

export default function PatientPortal({ user, token, onHoldTimerStart }) {
  const [viewTab, setViewTab] = useState('BOOK'); // 'BOOK' | 'MY_APPOINTMENTS'
  const [specialization, setSpecialization] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotsData, setSlotsData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [heldSlot, setHeldSlot] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [myAppointments, setMyAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Fetch doctors list
  useEffect(() => {
    fetchDoctors();
    if (token) fetchMyAppointments();
  }, [specialization, searchQuery, token]);

  // Fetch doctor slots when doctor or date changes
  useEffect(() => {
    if (selectedDoctor) {
      fetchSlots(selectedDoctor.id, selectedDate);
    }
  }, [selectedDoctor, selectedDate]);

  const fetchDoctors = async () => {
    try {
      let url = `/api/doctors?specialization=${specialization}`;
      if (searchQuery) url += `&query=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDoctors(data);
          if (data.length > 0 && !selectedDoctor) {
            setSelectedDoctor(data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchSlots = async (docId, dateStr) => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/doctors/${docId}/slots?date=${dateStr}`, { headers });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        setSlotsData(data);
      }
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAppointments = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/appointments/my-appointments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) setMyAppointments(data);
      }
    } catch (err) {
      console.error('Error fetching my appointments:', err);
    }
  };

  // Step 1: Hold Slot (5-minute TTL lock)
  const handleHoldSlot = async (slot) => {
    let activeToken = token;

    // Auto sign-in demo patient if user is not authenticated yet
    if (!activeToken) {
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'patient@drpatho.com', password: 'password123' }),
        });
        const loginData = await loginRes.json();
        if (loginData.token) {
          activeToken = loginData.token;
          localStorage.setItem('drpatho_token', activeToken);
          window.location.reload();
          return;
        }
      } catch (e) {
        setAlert({ type: 'error', text: 'Please sign in to lock and book an appointment slot.' });
        return;
      }
    }

    try {
      const res = await fetch('/api/appointments/hold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorProfileId: selectedDoctor.id,
          slotTime: slot.slotTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSelectedSlot(slot);
      setHeldSlot(data);
      setAlert({ type: 'success', text: 'Slot locked for 5 minutes! Please describe symptoms to finalize.' });
      onHoldTimerStart(300); // 5 minutes timer
      fetchSlots(selectedDoctor.id, selectedDate);
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    }
  };

  // Step 2: Book Slot with Symptoms
  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !symptoms.trim()) {
      setAlert({ type: 'error', text: 'Please provide your primary symptoms before confirming.' });
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctorProfileId: selectedDoctor.id,
          slotTime: selectedSlot.slotTime,
          symptoms,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAlert({ type: 'success', text: 'Appointment booked successfully! AI pre-visit summary generated.' });
      setSelectedSlot(null);
      setHeldSlot(null);
      setSymptoms('');
      onHoldTimerStart(0);
      fetchMyAppointments();
      setViewTab('MY_APPOINTMENTS');
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px 60px 24px' }}>
      {/* Alert Notification Toast */}
      {alert && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          marginBottom: '24px',
          background: alert.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${alert.type === 'success' ? '#A7F3D0' : '#FCA5A5'}`,
          color: alert.type === 'success' ? '#047857' : '#991B1B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{alert.text}</span>
          </div>
          <button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Mode Sub-Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <button
          onClick={() => setViewTab('BOOK')}
          className={viewTab === 'BOOK' ? 'btn-primary' : 'btn-secondary'}
        >
          <Stethoscope size={16} />
          <span>Find & Book Specialist</span>
        </button>
        <button
          onClick={() => setViewTab('MY_APPOINTMENTS')}
          className={viewTab === 'MY_APPOINTMENTS' ? 'btn-primary' : 'btn-secondary'}
        >
          <Calendar size={16} />
          <span>My Appointments ({myAppointments.length})</span>
        </button>
      </div>

      {viewTab === 'BOOK' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '32px' }}>
          {/* Left Column: Doctor Directory & Filters */}
          <div>
            {/* Specialization Filter Pills */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#64748B', display: 'block', marginBottom: '10px' }}>
                Filter Specialization
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {['ALL', 'Cardiology', 'Dermatology', 'General Medicine', 'Pediatrics'].map(spec => (
                  <button
                    key={spec}
                    onClick={() => setSpecialization(spec)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: '1px solid',
                      borderColor: specialization === spec ? '#DC2626' : '#E2E8F0',
                      background: specialization === spec ? '#FEF2F2' : '#FFFFFF',
                      color: specialization === spec ? '#DC2626' : '#64748B',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>

            {/* Doctor Cards Directory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {doctors.map(doc => {
                const isSelected = selectedDoctor?.id === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc)}
                    className="doppelrand-shell"
                    style={{
                      borderColor: isSelected ? '#DC2626' : 'rgba(226, 232, 240, 0.8)',
                      cursor: 'pointer'
                    }}
                  >
                    <div className="doppelrand-core" style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                            {doc.user?.name}
                          </h3>
                          <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: '700' }}>
                            {doc.specialization}
                          </span>
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                          ₹{doc.consultationFee}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', marginBottom: '10px' }}>
                        {doc.bio}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#94A3B8' }}>
                        <span>⏱ {doc.slotDurationMinutes} min slot</span>
                        <span>🕒 {doc.workingHoursStart} - {doc.workingHoursEnd}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Slot Selection & Pre-Visit Symptom Form */}
          <div>
            {selectedDoctor ? (
              <div className="doppelrand-shell">
                <div className="doppelrand-core" style={{ padding: '32px' }}>
                  {/* Doctor Profile Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '20px', marginBottom: '24px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A' }}>
                        {selectedDoctor.user?.name}
                      </h2>
                      <p style={{ fontSize: '14px', color: '#DC2626', fontWeight: '600' }}>
                        {selectedDoctor.specialization} • {selectedDoctor.experienceYears} Years Experience
                      </p>
                    </div>

                    {/* Date Picker */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={16} style={{ color: '#DC2626' }} />
                      <input
                        type="date"
                        value={selectedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="form-input"
                        style={{ padding: '8px 12px', fontSize: '13px', width: 'auto' }}
                      />
                    </div>
                  </div>

                  {/* Doctor Leave Banner if applicable */}
                  {slotsData?.isOnLeave ? (
                    <div style={{
                      padding: '20px',
                      borderRadius: '16px',
                      background: '#FFFBEB',
                      border: '1px solid #FDE68A',
                      color: '#B45309',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '24px'
                    }}>
                      <AlertTriangle size={20} />
                      <div>
                        <strong style={{ display: 'block', fontSize: '14px' }}>Doctor on Scheduled Leave</strong>
                        <span style={{ fontSize: '13px' }}>{slotsData.leaveReason}. Please select another date.</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Available Slot Grid */}
                      <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', marginBottom: '14px' }}>
                        Available Time Slots ({selectedDate})
                      </h3>

                      {loading ? (
                        <p style={{ color: '#64748B', fontSize: '14px' }}>Loading real-time availability...</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', marginBottom: '28px' }}>
                          {slotsData?.slots?.map((slot) => {
                            const isSelected = selectedSlot?.slotTime === slot.slotTime;
                            const isHeldByYou = slot.status === 'HELD_BY_YOU';
                            const isBookedOrHeldOther = slot.status === 'BOOKED' || slot.status === 'HELD_BY_OTHER' || slot.status === 'PAST';

                            return (
                              <button
                                key={slot.slotTime}
                                disabled={isBookedOrHeldOther}
                                onClick={() => handleHoldSlot(slot)}
                                className={`slot-btn ${isSelected ? 'selected' : ''} ${isHeldByYou ? 'held-by-you' : ''}`}
                              >
                                {slot.formattedTime}
                                {isHeldByYou && <span style={{ display: 'block', fontSize: '9px', fontWeight: '800' }}>LOCKED</span>}
                                {slot.status === 'BOOKED' && <span style={{ display: 'block', fontSize: '9px' }}>BOOKED</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Step 2: Pre-Visit Symptom Form */}
                      {selectedSlot && (
                        <form onSubmit={handleConfirmBooking} style={{ background: '#F8FAFC', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#DC2626', marginBottom: '12px' }}>
                            <Sparkles size={18} />
                            <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>
                              Describe Symptoms for AI Pre-Visit Triage
                            </h4>
                          </div>
                          <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
                            Our AI will analyze your symptoms to determine urgency level, chief complaint, and suggest doctor questions prior to your visit.
                          </p>

                          <textarea
                            required
                            rows="4"
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            placeholder="e.g. Chest tightness when exercising, mild shortness of breath, and fatigue over the past 3 days..."
                            className="form-textarea"
                            style={{ marginBottom: '16px' }}
                          />

                          <div style={{ display: 'flex', itemsAlign: 'center', justifyContent: 'space-between' }}>
                            <button
                              type="button"
                              onClick={() => { setSelectedSlot(null); onHoldTimerStart(0); }}
                              className="btn-secondary"
                            >
                              Release Slot
                            </button>

                            <button type="submit" disabled={bookingLoading} className="btn-primary">
                              <span>{bookingLoading ? 'Analyzing & Booking...' : 'Confirm Appointment'}</span>
                              <div className="btn-icon-circle">
                                <ArrowRight size={14} />
                              </div>
                            </button>
                          </div>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: '#64748B' }}>Select a doctor from the directory to view available slots.</p>
            )}
          </div>
        </div>
      ) : (
        /* Patient Appointments Dashboard */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {myAppointments.length === 0 ? (
            <div className="doppelrand-shell">
              <div className="doppelrand-core" style={{ textAlign: 'center', padding: '40px' }}>
                <Calendar size={36} style={{ color: '#94A3B8', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>No Appointments Booked Yet</h3>
                <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>Book your first appointment to access AI symptom triage and clinical summaries.</p>
              </div>
            </div>
          ) : (
            myAppointments.map(appt => {
              const dateStr = new Date(appt.slotTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = new Date(appt.slotTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const isCompleted = appt.status === 'COMPLETED';

              return (
                <div key={appt.id} className="doppelrand-shell">
                  <div className="doppelrand-core" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                            Dr. {appt.doctor.name}
                          </h3>
                          <span className={`badge-urgency-${(appt.preVisitUrgency || 'MEDIUM').toLowerCase()}`}>
                            Urgency: {appt.preVisitUrgency || 'Medium'}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                          📅 {dateStr} at {timeStr} • Status: <strong style={{ color: appt.status === 'CONFIRMED' ? '#047857' : appt.status === 'COMPLETED' ? '#2563EB' : '#DC2626' }}>{appt.status}</strong>
                        </p>
                      </div>

                      {/* Google Calendar Direct Add URL */}
                      <a
                        href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=DrPatho+Appointment+with+Dr.+${encodeURIComponent(appt.doctor.name)}&dates=${new Date(appt.slotTime).toISOString().replace(/-|:|\.\d\d\d/g, '')}/${new Date(appt.endTime).toISOString().replace(/-|:|\.\d\d\d/g, '')}&details=${encodeURIComponent(appt.symptoms)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                        style={{ fontSize: '12px', padding: '6px 14px' }}
                      >
                        <ExternalLink size={14} />
                        <span>Google Calendar</span>
                      </a>
                    </div>

                    {/* Pre-Visit AI Summary */}
                    <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #FEE2E2' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#991B1B', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} /> AI Pre-Visit Symptom Summary
                      </h4>
                      <p style={{ fontSize: '13px', color: '#7F1D1D', marginBottom: '8px' }}>
                        <strong>Chief Complaint:</strong> {appt.preVisitChiefComplaint || appt.symptoms}
                      </p>
                      {appt.preVisitSuggestedQuestions && appt.preVisitSuggestedQuestions.length > 0 && (
                        <div>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#991B1B' }}>Suggested Doctor Questions:</span>
                          <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#7F1D1D', marginTop: '4px' }}>
                            {appt.preVisitSuggestedQuestions.map((q, idx) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Post-Visit AI Summary (if Completed) */}
                    {isCompleted && appt.postVisitSummary && (
                      <div style={{ background: '#ECFDF5', padding: '16px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#047857', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={14} /> Patient-Friendly Post-Visit Summary
                        </h4>
                        <p style={{ fontSize: '13px', color: '#065F46', marginBottom: '8px' }}>
                          {appt.postVisitSummary}
                        </p>
                        {appt.postVisitMedicationSchedule && appt.postVisitMedicationSchedule.length > 0 && (
                          <div style={{ marginTop: '8px' }}>
                            <strong style={{ fontSize: '12px', color: '#047857' }}>Medication Schedule:</strong>
                            <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#065F46' }}>
                              {appt.postVisitMedicationSchedule.map((m, i) => <li key={i}>{m}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
