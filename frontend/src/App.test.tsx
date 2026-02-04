import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

describe('App', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('renders title', () => {
    render(<App />);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    render(<App />);
    expect(screen.getByText('subtitle')).toBeInTheDocument();
  });

  it('renders textarea', () => {
    render(<App />);
    expect(screen.getByPlaceholderText('titlePlaceholder')).toBeInTheDocument();
  });

  it('renders intensity buttons', () => {
    render(<App />);
    expect(screen.getByText('intensities.mild')).toBeInTheDocument();
    expect(screen.getByText('intensities.normal')).toBeInTheDocument();
    expect(screen.getByText('intensities.brutal')).toBeInTheDocument();
  });

  it('disables button when empty', () => {
    render(<App />);
    expect(screen.getByText('downgradeBtn')).toBeDisabled();
  });

  it('enables button with input', () => {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'Test' } });
    expect(screen.getByText('downgradeBtn')).not.toBeDisabled();
  });

  it('switches intensity', () => {
    render(<App />);
    const btn = screen.getByText('intensities.brutal');
    fireEvent.click(btn);
    expect(btn.className).toContain('active');
  });

  it('shows result on success', async () => {
    const mock = { original: 'Wow!', downgraded: 'Ok.', hype_score: 8, intensity: 'normal', language: 'en' };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mock) });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'Wow!' } });
    fireEvent.click(screen.getByText('downgradeBtn'));

    await waitFor(() => {
      expect(screen.getByText('Ok.')).toBeInTheDocument();
      expect(screen.getByText('8/10')).toBeInTheDocument();
    });
  });

  it('shows error on failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('downgradeBtn'));
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
  });

  it('shows loading state', () => {
    globalThis.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('downgradeBtn'));
    expect(screen.getByText('downgrading')).toBeInTheDocument();
  });

  it('renders language switcher', () => {
    render(<App />);
    expect(screen.getAllByTitle(/.+/).length).toBe(7);
  });

  it('renders footer', () => {
    render(<App />);
    expect(screen.getByText('footer')).toBeInTheDocument();
  });

  it('handles fetch exception', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('fail'));
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'X' } });
    fireEvent.click(screen.getByText('downgradeBtn'));
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
  });

  it('copy button works', async () => {
    const mock = { original: 'W', downgraded: 'Ok', hype_score: 5, intensity: 'normal', language: 'en' };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mock) });
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'W' } });
    fireEvent.click(screen.getByText('downgradeBtn'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('copy'));
    });
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Ok'));
  });

  it('renders hype bar segments', async () => {
    const mock = { original: 'W', downgraded: 'Ok', hype_score: 3, intensity: 'normal', language: 'en' };
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mock) });

    render(<App />);
    fireEvent.change(screen.getByPlaceholderText('titlePlaceholder'), { target: { value: 'W' } });
    fireEvent.click(screen.getByText('downgradeBtn'));

    await waitFor(() => {
      expect(screen.getByText('3/10')).toBeInTheDocument();
    });
  });
});
