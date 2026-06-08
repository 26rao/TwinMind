'use client';

import { useState, useCallback } from 'react';
import styles from './LoginScreen.module.css';

interface Props {
  onLogin: (name: string) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter your name to continue.'); return; }
    if (trimmed.length < 2) { setError('Name must be at least 2 characters.'); return; }
    onLogin(trimmed);
  }, [name, onLogin]);

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoMark}>⬡</span>
          <h1 className={styles.logoText}>ConvoIQ</h1>
        </div>
        <p className={styles.tagline}>Enterprise Meeting Intelligence Platform</p>

        <div className={styles.divider} />

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label} htmlFor="login-name">
            Your Name
          </label>
          <input
            id="login-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="e.g. Neha Rao"
            autoFocus
            autoComplete="name"
          />
          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.btn}>
            Enter Workspace →
          </button>
        </form>

        <p className={styles.disclaimer}>
          All data stays in your browser. Zero retention. Zero servers.
        </p>
      </div>
    </div>
  );
}
