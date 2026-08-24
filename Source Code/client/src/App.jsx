import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import PatientPortal from './components/PatientPortal';
import DoctorPortal from './components/DoctorPortal';
import AdminPortal from './components/AdminPortal';
import AuthModal from './components/AuthModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('drpatho_token') || '');
  const [activeRole, setActiveRole] = useState('PATIENT');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(0);

  // Load current user details if token present
  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUser(data.user);
            setActiveRole(data.user.role || 'PATIENT');
          } else {
            handleLogout();
          }
        })
        .catch(() => handleLogout());
    }
  }, [token]);

  // Handle Hold Timer Countdown
  useEffect(() => {
    if (holdSeconds <= 0) return;
    const interval = setInterval(() => {
      setHoldSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [holdSeconds]);

  const handleAuthSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('drpatho_token', userToken);
    setActiveRole(userData.role || 'PATIENT');
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('drpatho_token');
    setActiveRole('PATIENT');
  };

  // Seamless Role Tab Switcher with Instant Demo Account Login
  const handleSwitchRole = async (targetRole) => {
    setActiveRole(targetRole);

    if (targetRole === 'DOCTOR' && user?.role !== 'DOCTOR') {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'ananya.deshmukh@drpatho.com', password: 'password123' }),
        });
        const data = await res.json();
        if (data.token) {
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('drpatho_token', data.token);
        }
      } catch (e) {
        console.error('Doctor auto-login error:', e);
      }
    } else if (targetRole === 'ADMIN' && user?.role !== 'ADMIN') {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'admin@drpatho.com', password: 'admin123' }),
        });
        const data = await res.json();
        if (data.token) {
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('drpatho_token', data.token);
        }
      } catch (e) {
        console.error('Admin auto-login error:', e);
      }
    } else if (targetRole === 'PATIENT' && user?.role !== 'PATIENT' && !user) {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'patient@drpatho.com', password: 'password123' }),
        });
        const data = await res.json();
        if (data.token) {
          setUser(data.user);
          setToken(data.token);
          localStorage.setItem('drpatho_token', data.token);
        }
      } catch (e) {
        console.error('Patient auto-login error:', e);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Floating Header */}
      <Header
        user={user}
        activeRole={activeRole}
        onSwitchRole={handleSwitchRole}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        activeHoldTimer={holdSeconds > 0 ? holdSeconds : null}
      />

      {/* Main Content Area based on Active Role Portal */}
      <main style={{ flex: 1 }}>
        {activeRole === 'PATIENT' && (
          <PatientPortal
            user={user}
            token={token}
            onHoldTimerStart={(seconds) => setHoldSeconds(seconds)}
          />
        )}

        {activeRole === 'DOCTOR' && (
          <DoctorPortal user={user} token={token} />
        )}

        {activeRole === 'ADMIN' && (
          <AdminPortal user={user} token={token} />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #E2E8F0',
        padding: '24px 0',
        textAlign: 'center',
        color: '#64748B',
        fontSize: '13px',
        background: '#FFFFFF',
        marginTop: 'auto'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: '800', color: '#DC2626' }}>DrPatho Appointments</span>
            <span>&copy; 2026 Healthcare Management System.</span>
          </div>
          <div>
            <span style={{ color: '#047857', fontWeight: '600' }}>● System Status: Fully Operational</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
