import React from 'react';
import { UserCheck, Stethoscope, Shield, Calendar, Clock, LogOut, LogIn } from 'lucide-react';

export default function Header({ user, activeRole, onSwitchRole, onOpenAuth, onLogout, activeHoldTimer }) {
  return (
    <header className="glass-header">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #DC2626, #991B1B)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
          position: 'relative'
        }}>
          {/* Healthcare Plus + Stethoscope SVG */}
          <svg width="26" height="26" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 50H70M50 30V70" stroke="white" strokeWidth="12" strokeLinecap="round"/>
            <path d="M25 35C25 60 40 75 50 75C60 75 75 60 75 35" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.85"/>
            <circle cx="25" cy="30" r="5" fill="white"/>
            <circle cx="75" cy="30" r="5" fill="white"/>
          </svg>
        </div>

        <div>
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.5px', margin: 0, lineHeight: 1.1 }}>
            DrPatho <span style={{ color: '#DC2626', fontWeight: '700' }}>Appointments</span>
          </h1>
          <p style={{ fontSize: '11px', color: '#64748B', fontWeight: '500', margin: 0 }}>
            Intelligent Clinical & Appointment Platform
          </p>
        </div>
      </div>

      {/* Center Hold Countdown Pill if active */}
      {activeHoldTimer && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#FFFBEB',
          border: '1px solid #F59E0B',
          padding: '6px 14px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: '700',
          color: '#B45309',
          animation: 'pulse 1.5s infinite'
        }}>
          <Clock size={14} className="animate-spin" />
          <span>Slot Hold Locked: {activeHoldTimer}s remaining</span>
        </div>
      )}

      {/* Role Switcher & User Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Role Selector Tabs */}
        <div style={{
          display: 'flex',
          background: '#F1F5F9',
          padding: '4px',
          borderRadius: '999px',
          border: '1px solid #E2E8F0'
        }}>
          <button
            onClick={() => onSwitchRole('PATIENT')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              background: activeRole === 'PATIENT' ? '#DC2626' : 'transparent',
              color: activeRole === 'PATIENT' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.2s ease'
            }}
          >
            Patient Portal
          </button>
          <button
            onClick={() => onSwitchRole('DOCTOR')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              background: activeRole === 'DOCTOR' ? '#DC2626' : 'transparent',
              color: activeRole === 'DOCTOR' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.2s ease'
            }}
          >
            Doctor Portal
          </button>
          <button
            onClick={() => onSwitchRole('ADMIN')}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: '700',
              border: 'none',
              cursor: 'pointer',
              background: activeRole === 'ADMIN' ? '#DC2626' : 'transparent',
              color: activeRole === 'ADMIN' ? '#FFFFFF' : '#64748B',
              transition: 'all 0.2s ease'
            }}
          >
            Admin Portal
          </button>
        </div>

        {/* User Account / Auth button */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              padding: '6px 12px',
              borderRadius: '999px',
              fontSize: '12px',
              color: '#991B1B',
              fontWeight: '600'
            }}>
              <UserCheck size={14} />
              <span>{user.name}</span>
            </div>
            <button
              onClick={onLogout}
              title="Log out"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94A3B8',
                padding: '6px'
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button onClick={onOpenAuth} className="btn-primary">
            <span>Sign In</span>
            <div className="btn-icon-circle">
              <LogIn size={14} />
            </div>
          </button>
        )}
      </div>
    </header>
  );
}
