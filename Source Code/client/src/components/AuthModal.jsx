import React, { useState } from 'react';
import { X, LogIn, UserPlus, Shield, Stethoscope, User } from 'lucide-react';
import { getApiUrl } from '../apiConfig';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('PATIENT');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Quick Demo Account Auto-Fill
  const handleFillDemo = (type) => {
    setIsLogin(true);
    if (type === 'PATIENT') {
      setEmail('patient@drpatho.com');
      setPassword('password123');
    } else if (type === 'DOCTOR') {
      setEmail('ananya.deshmukh@drpatho.com');
      setPassword('password123');
    } else if (type === 'ADMIN') {
      setEmail('admin@drpatho.com');
      setPassword('admin123');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = getApiUrl(isLogin ? '/api/auth/login' : '/api/auth/register');
    const payload = isLogin
      ? { email, password }
      : { name, email, password, role, specialization };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error('Connecting to backend server... Render free tier instances take ~20 seconds to wake up on first visit. Please wait a moment and try again.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed. Please check your credentials.');
      }

      onAuthSuccess(data.user, data.token);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>
            {isLogin ? 'Sign In to DrPatho' : 'Create DrPatho Account'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Quick Demo Credentials Autofill Pills */}
        <div style={{ marginBottom: '20px', background: '#FEF2F2', padding: '12px', borderRadius: '12px', border: '1px solid #FCA5A5' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#991B1B', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            ⚡ One-Click Demo Credentials Autofill:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => handleFillDemo('PATIENT')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '999px', border: '1px solid #DC2626', background: '#FFFFFF', color: '#DC2626', cursor: 'pointer' }}>
              Aarav Mehta (Patient)
            </button>
            <button type="button" onClick={() => handleFillDemo('DOCTOR')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '999px', border: '1px solid #DC2626', background: '#FFFFFF', color: '#DC2626', cursor: 'pointer' }}>
              Dr. Ananya Deshmukh (Doctor)
            </button>
            <button type="button" onClick={() => handleFillDemo('ADMIN')} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '700', borderRadius: '999px', border: '1px solid #DC2626', background: '#FFFFFF', color: '#DC2626', cursor: 'pointer' }}>
              Rajesh Sharma (Admin)
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Full Name</label>
              <input type="text" required placeholder="Aarav Mehta" value={name} onChange={e => setName(e.target.value)} className="form-input" />
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Email Address</label>
            <input type="email" required placeholder="name@drpatho.com" value={email} onChange={e => setEmail(e.target.value)} className="form-input" />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '4px' }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="form-input" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            {isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
            <span>{loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Create Account'}</span>
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{ background: 'none', border: 'none', color: '#DC2626', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
          >
            {isLogin ? "Don't have an account? Register" : "Already registered? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
