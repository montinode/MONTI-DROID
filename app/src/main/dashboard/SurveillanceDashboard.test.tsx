/**
 * Unit tests for the JCM_2026 Surveillance Dashboard component.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import SurveillanceDashboard from './SurveillanceDashboard';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

/** Advance fake timers past the 600 ms simulated fetch and flush promises. */
async function advanceTimersAndFlush() {
  await act(async () => {
    jest.advanceTimersByTime(700);
    // Flush the microtask queue so resolved Promises update React state.
    await Promise.resolve();
  });
}

describe('SurveillanceDashboard', () => {
  it('renders the dashboard title', async () => {
    await act(async () => {
      render(<SurveillanceDashboard />);
    });
    expect(screen.getByText('JCM_2026')).toBeInTheDocument();
    // The header subtitle uses the exact text "Surveillance Dashboard"
    expect(screen.getByText('Surveillance Dashboard')).toBeInTheDocument();
  });

  it('renders the three module headings', async () => {
    await act(async () => {
      render(<SurveillanceDashboard />);
    });
    expect(screen.getByText('Network Status')).toBeInTheDocument();
    expect(screen.getByText('System Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Connectivity Check')).toBeInTheDocument();
  });

  it('shows module subtitles that reference the backing scripts', async () => {
    await act(async () => {
      render(<SurveillanceDashboard />);
    });
    expect(screen.getByText(/ScanNetwork\.py/)).toBeInTheDocument();
    expect(screen.getByText(/johncharlesmonti_monitor\.py/)).toBeInTheDocument();
    expect(screen.getByText(/check_connectivity\.sh/)).toBeInTheDocument();
  });

  it('shows a Refresh button', async () => {
    await act(async () => {
      render(<SurveillanceDashboard />);
    });
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('shows loaded network data after initial refresh resolves', async () => {
    await act(async () => {
      render(<SurveillanceDashboard />);
    });
    await advanceTimersAndFlush();
    expect(screen.getByText('192.168.1.0/24')).toBeInTheDocument();
  });

  it('renders the footer copy', async () => {
    await act(async () => {
      render(<SurveillanceDashboard />);
    });
    expect(
      screen.getByText(/MONTI-DROID · JCM_2026 Surveillance Dashboard/),
    ).toBeInTheDocument();
  });
});
