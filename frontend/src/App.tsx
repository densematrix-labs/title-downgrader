import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTokenStore } from './stores/tokenStore';
import { getDeviceId } from './lib/fingerprint';
import { getTrialStatus, downgradeTitle } from './services/api';
import './App.css';

const LANGUAGES = [
  { code: 'en', flag: '🇺🇸', name: 'English' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
];

const INTENSITIES = ['mild', 'normal', 'brutal'] as const;

interface DowngradeResult {
  original: string;
  downgraded: string;
  hype_score: number;
  intensity: string;
  language: string;
}

function HypeBar({ score }: { score: number }) {
  return (
    <div className="hype-bar">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={`hype-segment ${i < score ? 'filled' : ''}`} />
      ))}
      <span className="hype-label">{score}/10</span>
    </div>
  );
}

function App() {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState('');
  const [intensity, setIntensity] = useState<string>('normal');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DowngradeResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [hasFreeTrial, setHasFreeTrial] = useState<boolean | null>(null);

  const { getActiveToken, getTotalGenerations, updateTokenUsage } = useTokenStore();
  const activeToken = getActiveToken();
  const totalCredits = getTotalGenerations();

  // Initialize device ID and check trial status
  useEffect(() => {
    async function init() {
      const id = await getDeviceId();
      setDeviceId(id);
      try {
        const status = await getTrialStatus(id);
        setHasFreeTrial(status.has_free_trial);
      } catch {
        // If API fails, assume trial available
        setHasFreeTrial(true);
      }
    }
    init();
  }, []);

  const canDowngrade = hasFreeTrial || totalCredits > 0;

  const handleDowngrade = async () => {
    if (!title.trim() || !deviceId) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload: {
        title: string;
        intensity: string;
        language: string;
        device_id?: string;
        token?: string;
      } = {
        title: title.trim(),
        intensity,
        language: i18n.language,
      };

      // Use paid token if available, otherwise fall back to free trial
      if (activeToken) {
        payload.token = activeToken.token;
      } else {
        payload.device_id = deviceId;
      }

      const data = await downgradeTitle(payload);
      setResult(data);

      // Update local token state after successful use
      if (activeToken) {
        updateTokenUsage(activeToken.token, activeToken.remaining_generations - 1);
      } else {
        // Free trial used, update status
        setHasFreeTrial(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('error');
      if (message.includes('402') || message.includes('trial') || message.includes('Token')) {
        setError(t('needCredits'));
        setHasFreeTrial(false);
      } else {
        setError(t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.downgraded);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app">
      <header>
        <div className="lang-switcher">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`lang-btn ${i18n.language === l.code ? 'active' : ''}`}
              onClick={() => i18n.changeLanguage(l.code)}
              title={l.name}
            >
              {l.flag}
            </button>
          ))}
        </div>
        <h1>{t('title')}</h1>
        <p className="subtitle">{t('subtitle')}</p>

        {/* Credits indicator + pricing link */}
        <div className="credits-bar">
          {totalCredits > 0 ? (
            <span className="credits-count">
              {t('creditsRemaining', { count: totalCredits })}
            </span>
          ) : hasFreeTrial ? (
            <span className="credits-count free-trial">
              {t('freeTrialAvailable')}
            </span>
          ) : (
            <span className="credits-count no-credits">
              {t('noCredits')}
            </span>
          )}
          <Link to="/pricing" className="pricing-link">
            {t('buyCredits')}
          </Link>
        </div>
      </header>

      <main>
        <div className="input-section">
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
            rows={3}
            maxLength={500}
          />

          <div className="controls">
            <div className="intensity-select">
              <label>{t('intensityLabel')}:</label>
              <div className="intensity-buttons">
                {INTENSITIES.map((i) => (
                  <button
                    key={i}
                    className={`intensity-btn ${intensity === i ? 'active' : ''}`}
                    onClick={() => setIntensity(i)}
                  >
                    {t(`intensities.${i}`)}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="downgrade-btn"
              onClick={handleDowngrade}
              disabled={loading || !title.trim() || !canDowngrade}
            >
              {loading ? t('downgrading') : !canDowngrade ? t('buyToDowngrade') : t('downgradeBtn')}
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {result && (
          <div className="result-section">
            <div className="hype-section">
              <span className="hype-title">{t('hypeScore')}</span>
              <HypeBar score={result.hype_score} />
            </div>

            <div className="comparison">
              <div className="result-card original">
                <h3>{t('original')}</h3>
                <p className="result-text">{result.original}</p>
              </div>

              <div className="arrow">⬇️</div>

              <div className="result-card downgraded">
                <h3>{t('downgraded')}</h3>
                <p className="result-text">{result.downgraded}</p>
                <button className="copy-btn" onClick={handleCopy}>
                  {copied ? t('copied') : t('copy')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <p>{t('footer')}</p>
      </footer>
    </div>
  );
}

export default App;
