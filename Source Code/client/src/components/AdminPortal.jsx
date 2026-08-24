import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Calendar, Activity, RefreshCw, CheckCircle2, AlertTriangle, Shield, Clock } from 'lucide-react';

export default function AdminPortal({ user, token }) {
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState('STATS'); // 'STATS' | 'CREATE_DOCTOR' | 'NOTIFICATIONS'
  const [newDoctor, setNewDoctor] = useState({
    name: '',
    email: '',
    password: 'password123',
    specialization: 'Cardiology',
    bio: '',
    consultationFee: 800,
    slotDurationMinutes: 30,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
  });
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetchStats();
      fetchDoctors();
      fetchNotifications();
    }
  }, [token]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/doctors');
      const data = await res.json();
      setDoctors(data);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleCreateDoctor = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/doctors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newDoctor),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAlert({ type: 'success', text: `Doctor profile created for Dr. ${newDoctor.name}!` });
      setNewDoctor({
        name: '',
        email: '',
        password: 'password123',
        specialization: 'Cardiology',
        bio: '',
        consultationFee: 80,
        slotDurationMinutes: 30,
        workingHoursStart: '09:00',
        workingHoursEnd: '17:00',
      });
      fetchDoctors();
      fetchStats();
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryNotification = async (logId) => {
    try {
      const res = await fetch(`/api/admin/notifications/${logId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAlert({ type: data.success ? 'success' : 'error', text: data.message });
      fetchNotifications();
    } catch (err) {
      setAlert({ type: 'error', text: 'Retry execution error' });
    }
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '0 24px 60px 24px' }}>
      {/* Toast Alert */}
      {alert && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          marginBottom: '24px',
          background: alert.type === 'success' ? '#ECFDF5' : '#FEF2F2',
          border: `1px solid ${alert.type === 'success' ? '#A7F3D0' : '#FCA5A5'}`,
          color: alert.type === 'success' ? '#047857' : '#991B1B',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          {alert.text}
        </div>
      )}

      {/* Admin Tab Bar */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <button onClick={() => setActiveTab('STATS')} className={activeTab === 'STATS' ? 'btn-primary' : 'btn-secondary'}>
          <Activity size={16} />
          <span>System Metrics</span>
        </button>
        <button onClick={() => setActiveTab('CREATE_DOCTOR')} className={activeTab === 'CREATE_DOCTOR' ? 'btn-primary' : 'btn-secondary'}>
          <UserPlus size={16} />
          <span>Doctor Onboarding ({doctors.length})</span>
        </button>
        <button onClick={() => setActiveTab('NOTIFICATIONS')} className={activeTab === 'NOTIFICATIONS' ? 'btn-primary' : 'btn-secondary'}>
          <Shield size={16} />
          <span>Notification Logs & Retries</span>
        </button>
      </div>

      {activeTab === 'STATS' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          <div className="doppelrand-shell">
            <div className="doppelrand-core" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Total Patients</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{stats.totalPatients}</h2>
            </div>
          </div>
          <div className="doppelrand-shell">
            <div className="doppelrand-core" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Active Doctors</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#DC2626', marginTop: '4px' }}>{stats.totalDoctors}</h2>
            </div>
          </div>
          <div className="doppelrand-shell">
            <div className="doppelrand-core" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Booked Appointments</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', marginTop: '4px' }}>{stats.totalAppointments}</h2>
            </div>
          </div>
          <div className="doppelrand-shell">
            <div className="doppelrand-core" style={{ padding: '24px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>Active 5-Min Holds</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#F59E0B', marginTop: '4px' }}>{stats.activeHolds}</h2>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'CREATE_DOCTOR' && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '32px' }}>
          {/* Create Doctor Form */}
          <div className="doppelrand-shell">
            <div className="doppelrand-core" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', marginBottom: '20px' }}>
                Onboard New Doctor
              </h3>
              <form onSubmit={handleCreateDoctor}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Full Name</label>
                  <input type="text" required placeholder="Dr. Jane Smith" value={newDoctor.name} onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })} className="form-input" />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Email Address</label>
                  <input type="email" required placeholder="jane.smith@drpatho.com" value={newDoctor.email} onChange={e => setNewDoctor({ ...newDoctor, email: e.target.value })} className="form-input" />
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Specialization</label>
                  <select value={newDoctor.specialization} onChange={e => setNewDoctor({ ...newDoctor, specialization: e.target.value })} className="form-select">
                    <option value="Cardiology">Cardiology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="General Medicine">General Medicine</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Orthopedics">Orthopedics</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Start Hours</label>
                    <input type="text" value={newDoctor.workingHoursStart} onChange={e => setNewDoctor({ ...newDoctor, workingHoursStart: e.target.value })} className="form-input" />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>End Hours</label>
                    <input type="text" value={newDoctor.workingHoursEnd} onChange={e => setNewDoctor({ ...newDoctor, workingHoursEnd: e.target.value })} className="form-input" />
                  </div>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Consultation Fee (₹)</label>
                  <input type="number" value={newDoctor.consultationFee} onChange={e => setNewDoctor({ ...newDoctor, consultationFee: e.target.value })} className="form-input" />
                </div>
                <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <UserPlus size={16} />
                  <span>{loading ? 'Creating Doctor...' : 'Save Doctor Profile'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Active Doctor Roster */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Active Doctor Roster</h3>
            {doctors.map(doc => (
              <div key={doc.id} className="doppelrand-shell">
                <div className="doppelrand-core" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>{doc.user?.name}</h4>
                    <p style={{ fontSize: '12px', color: '#DC2626', fontWeight: '700' }}>{doc.specialization} • ₹{doc.consultationFee} fee</p>
                    <p style={{ fontSize: '11px', color: '#64748B' }}>Working Hours: {doc.workingHoursStart} - {doc.workingHoursEnd} ({doc.slotDurationMinutes} min slot)</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'NOTIFICATIONS' && (
        <div className="doppelrand-shell">
          <div className="doppelrand-core" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>Notification Delivery Log & Retry Queue</h3>
              <button onClick={fetchNotifications} className="btn-secondary" style={{ fontSize: '12px' }}>
                <RefreshCw size={14} /> Refresh Log
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#64748B' }}>
                    <th style={{ padding: '10px' }}>Type</th>
                    <th style={{ padding: '10px' }}>Recipient</th>
                    <th style={{ padding: '10px' }}>Subject</th>
                    <th style={{ padding: '10px' }}>Status</th>
                    <th style={{ padding: '10px' }}>Attempts</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px', fontWeight: '700', color: '#0F172A' }}>{log.type}</td>
                      <td style={{ padding: '10px' }}>{log.recipientEmail}</td>
                      <td style={{ padding: '10px', color: '#475569' }}>{log.subject}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: log.status === 'SENT' ? '#ECFDF5' : log.status === 'PENDING' ? '#FFFBEB' : '#FEF2F2',
                          color: log.status === 'SENT' ? '#047857' : log.status === 'PENDING' ? '#B45309' : '#991B1B'
                        }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{log.attempts}/{log.maxAttempts}</td>
                      <td style={{ padding: '10px' }}>
                        {log.status === 'FAILED' && (
                          <button onClick={() => handleRetryNotification(log.id)} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }}>
                            Retry Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
