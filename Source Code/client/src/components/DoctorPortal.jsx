import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Sparkles, CheckCircle2, AlertTriangle, User, FileText, Plus, Trash2, X, Send } from 'lucide-react';

export default function DoctorPortal({ user, token }) {
  const [appointments, setAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState('SCHEDULE'); // 'SCHEDULE' | 'LEAVE'
  const [selectedAppt, setSelectedAppt] = useState(null); // Appt to complete
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [medications, setMedications] = useState([{ name: '', dosage: '', frequency: 'Twice daily', durationDays: 5 }]);
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (token) fetchAppointments();
  }, [token]);

  const fetchAppointments = async () => {
    try {
      const res = await fetch('/api/appointments/my-appointments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAppointments(data);
    } catch (err) {
      console.error('Error fetching doctor appointments:', err);
    }
  };

  // Add medication row
  const addMedicationRow = () => {
    setMedications([...medications, { name: '', dosage: '', frequency: 'Twice daily', durationDays: 5 }]);
  };

  const removeMedicationRow = (index) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index, field, value) => {
    const updated = [...medications];
    updated[index][field] = value;
    setMedications(updated);
  };

  // Submit Visit Completion Notes & Prescription -> LLM Summary
  const handleCompleteVisit = async (e) => {
    e.preventDefault();
    if (!selectedAppt || !clinicalNotes.trim()) return;

    setSubmitting(true);
    try {
      const validMeds = medications.filter(m => m.name.trim() !== '');

      const res = await fetch(`/api/appointments/${selectedAppt.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clinicalNotes,
          medications: validMeds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAlert({ type: 'success', text: 'Visit finalized! Patient-friendly summary & prescription generated.' });
      setSelectedAppt(null);
      setClinicalNotes('');
      fetchAppointments();
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Doctor Leave Application
  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd) return;

    try {
      const res = await fetch('/api/doctors/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          startDate: leaveStart,
          endDate: leaveEnd,
          reason: leaveReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAlert({
        type: 'success',
        text: `Leave recorded! ${data.affectedAppointmentsCount} conflicting appointments auto-cancelled & patients notified.`,
      });
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      fetchAppointments();
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    }
  };

  const handleDoctorLogin = async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ananya.deshmukh@drpatho.com', password: 'password123' }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('drpatho_token', data.token);
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px 60px 24px' }}>
      {/* Doctor Active Session Header Banner */}
      <div style={{
        background: user?.role === 'DOCTOR' ? '#FEF2F2' : '#FFFBEB',
        border: `1px solid ${user?.role === 'DOCTOR' ? '#FCA5A5' : '#FDE68A'}`,
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: user?.role === 'DOCTOR' ? '#DC2626' : '#F59E0B',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0 }}>
              {user?.role === 'DOCTOR' ? `Doctor Portal: ${user.name}` : 'Doctor Portal (Guest / Patient View)'}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>
              {user?.role === 'DOCTOR' ? 'Authenticated Clinical Workspace • Manage consultations & AI summaries' : 'Sign in as a doctor to view patient pre-visit summaries and prescribe medications.'}
            </p>
          </div>
        </div>

        {user?.role !== 'DOCTOR' && (
          <button onClick={handleDoctorLogin} className="btn-primary" style={{ fontSize: '12px', padding: '8px 16px' }}>
            <span>Sign in as Dr. Ananya Deshmukh</span>
          </button>
        )}
      </div>

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
          <span>{alert.text}</span>
          <button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <button
          onClick={() => setActiveTab('SCHEDULE')}
          className={activeTab === 'SCHEDULE' ? 'btn-primary' : 'btn-secondary'}
        >
          <Calendar size={16} />
          <span>Patient Schedule & AI Summaries ({appointments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('LEAVE')}
          className={activeTab === 'LEAVE' ? 'btn-primary' : 'btn-secondary'}
        >
          <AlertTriangle size={16} />
          <span>Manage Leave & Conflicts</span>
        </button>
      </div>

      {activeTab === 'SCHEDULE' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {appointments.length === 0 ? (
            <div className="doppelrand-shell">
              <div className="doppelrand-core" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                No appointments scheduled currently.
              </div>
            </div>
          ) : (
            appointments.map(appt => {
              const dateStr = new Date(appt.slotTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = new Date(appt.slotTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
              const isConfirmed = appt.status === 'CONFIRMED';

              return (
                <div key={appt.id} className="doppelrand-shell">
                  <div className="doppelrand-core" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                            Patient: {appt.patient.name}
                          </h3>
                          <span className={`badge-urgency-${(appt.preVisitUrgency || 'MEDIUM').toLowerCase()}`}>
                            Urgency: {appt.preVisitUrgency || 'Medium'}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                          📅 {dateStr} at {timeStr} • Status: <strong style={{ color: appt.status === 'CONFIRMED' ? '#047857' : '#DC2626' }}>{appt.status}</strong>
                        </p>
                      </div>

                      {isConfirmed && (
                        <button onClick={() => setSelectedAppt(appt)} className="btn-primary" style={{ fontSize: '13px', padding: '8px 18px' }}>
                          <FileText size={14} />
                          <span>Complete Visit & Prescribe</span>
                        </button>
                      )}
                    </div>

                    {/* Pre-Visit AI Summary */}
                    <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '12px', border: '1px solid #FEE2E2', marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#991B1B', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} /> AI Pre-Visit Symptom Analysis
                      </h4>
                      <p style={{ fontSize: '13px', color: '#7F1D1D', marginBottom: '8px' }}>
                        <strong>Patient Symptoms:</strong> {appt.symptoms}
                      </p>
                      <p style={{ fontSize: '13px', color: '#7F1D1D', marginBottom: '8px' }}>
                        <strong>Chief Complaint:</strong> {appt.preVisitChiefComplaint || appt.symptoms}
                      </p>
                      {appt.preVisitSuggestedQuestions && appt.preVisitSuggestedQuestions.length > 0 && (
                        <div>
                          <strong style={{ fontSize: '12px', color: '#991B1B' }}>3 Suggested Questions for Doctor:</strong>
                          <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#7F1D1D', marginTop: '4px' }}>
                            {appt.preVisitSuggestedQuestions.map((q, idx) => <li key={idx}>{q}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Post-Visit Clinical Record if completed */}
                    {appt.status === 'COMPLETED' && (
                      <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>
                          Completed Clinical Notes
                        </h4>
                        <p style={{ fontSize: '13px', color: '#475569' }}>{appt.postVisitNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Leave Management Tab */
        <div className="doppelrand-shell" style={{ maxWidth: '640px' }}>
          <div className="doppelrand-core" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', marginBottom: '8px' }}>
              Schedule Doctor Leave
            </h2>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '24px' }}>
              Applying leave automatically flags conflicting booked appointments, sets their status to <code>CANCELLED_DUE_TO_LEAVE</code>, and sends cancellation notifications to affected patients.
            </p>

            <form onSubmit={handleApplyLeave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>Start Date</label>
                  <input type="date" required value={leaveStart} onChange={e => setLeaveStart(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>End Date</label>
                  <input type="date" required value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} className="form-input" />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>Reason for Leave</label>
                <input type="text" placeholder="e.g. Annual Medical Conference / Personal Leave" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} className="form-input" />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <AlertTriangle size={16} />
                <span>Apply Leave & Trigger Patient Notifications</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Complete Visit Modal */}
      {selectedAppt && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
                Complete Visit for {selectedAppt.patient.name}
              </h3>
              <button onClick={() => setSelectedAppt(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCompleteVisit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                  Clinical Notes & Diagnosis
                </label>
                <textarea
                  required
                  rows="4"
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="e.g. Patient presents with mild hypertension. Blood pressure 138/88. Recommend daily monitoring and dietary salt restriction..."
                  className="form-textarea"
                />
              </div>

              {/* Prescription Builder */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                    Prescribed Medications & Schedule
                  </label>
                  <button type="button" onClick={addMedicationRow} className="btn-secondary" style={{ fontSize: '12px', padding: '4px 10px' }}>
                    <Plus size={14} /> Add Drug
                  </button>
                </div>

                {medications.map((med, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 30px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <input type="text" placeholder="Medication Name" value={med.name} onChange={e => updateMedication(idx, 'name', e.target.value)} className="form-input" style={{ fontSize: '12px', padding: '8px' }} />
                    <input type="text" placeholder="Dose (e.g. 500mg)" value={med.dosage} onChange={e => updateMedication(idx, 'dosage', e.target.value)} className="form-input" style={{ fontSize: '12px', padding: '8px' }} />
                    <input type="text" placeholder="Frequency" value={med.frequency} onChange={e => updateMedication(idx, 'frequency', e.target.value)} className="form-input" style={{ fontSize: '12px', padding: '8px' }} />
                    <input type="number" placeholder="Days" value={med.durationDays} onChange={e => updateMedication(idx, 'durationDays', e.target.value)} className="form-input" style={{ fontSize: '12px', padding: '8px' }} />
                    <button type="button" onClick={() => removeMedicationRow(idx)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setSelectedAppt(null)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  <Send size={14} />
                  <span>{submitting ? 'Generating AI Summary...' : 'Submit & Generate Patient Summary'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
