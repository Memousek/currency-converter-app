import { useState, useCallback, useEffect } from "react";
import "./App.css";

const CACHE_KEY = "fx_cache";

// Fallback rates seeded at build time — used only if a pair has never been
// fetched online. Overwritten automatically after the first successful fetch.
const SEED_RATES = [
  { from: "JPY", to: "CZK", rate: 0.163, date: "2026-02-01" },
  { from: "EUR", to: "CZK", rate: 25.15, date: "2026-02-01" },
  { from: "USD", to: "CZK", rate: 23.45, date: "2026-02-01" },
  { from: "EUR", to: "USD", rate: 1.048, date: "2026-02-01" },
  { from: "EUR", to: "JPY", rate: 157.5, date: "2026-02-01" },
  { from: "JPY", to: "USD", rate: 0.00665, date: "2026-02-01" },
];

// Primary + fallback CDN (no CORS, no API key, free)
const API_PRIMARY = (base) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${base.toLowerCase()}.json`;
const API_FALLBACK = (base) =>
  `https://latest.currency-api.pages.dev/v1/currencies/${base.toLowerCase()}.json`;

const CURRENCIES = [
  ["AUD", "Australian Dollar"],
  ["BGN", "Bulgarian Lev"],
  ["BRL", "Brazilian Real"],
  ["CAD", "Canadian Dollar"],
  ["CHF", "Swiss Franc"],
  ["CNY", "Chinese Renminbi Yuan"],
  ["CZK", "Czech Koruna"],
  ["DKK", "Danish Krone"],
  ["EUR", "Euro"],
  ["GBP", "British Pound"],
  ["HKD", "Hong Kong Dollar"],
  ["HUF", "Hungarian Forint"],
  ["IDR", "Indonesian Rupiah"],
  ["ILS", "Israeli New Sheqel"],
  ["INR", "Indian Rupee"],
  ["ISK", "Icelandic Krona"],
  ["JPY", "Japanese Yen"],
  ["KRW", "South Korean Won"],
  ["MXN", "Mexican Peso"],
  ["MYR", "Malaysian Ringgit"],
  ["NOK", "Norwegian Krone"],
  ["NZD", "New Zealand Dollar"],
  ["PHP", "Philippine Peso"],
  ["PLN", "Polish Zloty"],
  ["RON", "Romanian Leu"],
  ["SEK", "Swedish Krona"],
  ["SGD", "Singapore Dollar"],
  ["THB", "Thai Baht"],
  ["TRY", "Turkish Lira"],
  ["USD", "US Dollar"],
  ["ZAR", "South African Rand"],
];

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(from, to, rate, date) {
  const cache = getCache();
  cache[`${from}_${to}`] = { rate, date };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function getCached(from, to) {
  return getCache()[`${from}_${to}`] || null;
}

function seedCache() {
  const cache = getCache();
  let changed = false;
  for (const { from, to, rate, date } of SEED_RATES) {
    if (!cache[`${from}_${to}`]) {
      cache[`${from}_${to}`] = { rate, date };
      changed = true;
    }
  }
  if (changed) localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

seedCache();

async function fetchRate(from, to) {
  const tryFetch = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error();
    const data = await r.json();
    const rate = data[from.toLowerCase()]?.[to.toLowerCase()];
    if (!rate) throw new Error();
    return { rate, date: data.date };
  };

  try {
    return await tryFetch(API_PRIMARY(from));
  } catch {
    return await tryFetch(API_FALLBACK(from));
  }
}

const VALID_CODES = new Set(CURRENCIES.map(([code]) => code));

function getParams() {
  const p = new URLSearchParams(window.location.search);
  const amount = p.get("amount");
  const from = p.get("from")?.toUpperCase();
  const to = p.get("to")?.toUpperCase();
  return {
    amount: amount && parseFloat(amount) > 0 ? amount : "1",
    from: from && VALID_CODES.has(from) ? from : "JPY",
    to: to && VALID_CODES.has(to) ? to : "CZK",
  };
}

const initial = getParams();
const searchParams = new URLSearchParams(window.location.search);
const hasAmountParam = searchParams.has("amount");
const isCompact = searchParams.get("variant") === "compact";
const colorParam = searchParams.get("color");
const colorScheme = colorParam === "dark" ? "dark" : colorParam === "light" ? "light" : "auto";
const isEmbedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function Attribution() {
  return (
    <div className="attribution">
      Converted using{" "}
      <a
        href={window.location.origin}
        target="_blank"
        rel="noopener noreferrer"
      >
        FX Convert
      </a>
    </div>
  );
}

export default function App() {
  const [amount, setAmount] = useState(initial.amount);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const convert = useCallback(async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) return;

    if (from === to) {
      setResult({ converted: num, rate: 1 });
      setOffline(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setOffline(false);

    try {
      const { rate, date } = await fetchRate(from, to);
      saveCache(from, to, rate, date);
      setResult({ converted: num * rate, rate });
    } catch {
      const cached = getCached(from, to);
      if (cached) {
        setResult({
          converted: num * cached.rate,
          rate: cached.rate,
          cachedDate: cached.date,
        });
        setOffline(true);
      } else {
        setError("Conversion failed and no cached data available.");
      }
    } finally {
      setLoading(false);
    }
  }, [amount, from, to]);

  useEffect(() => {
    if (isCompact || hasAmountParam) convert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
    setOffline(false);
    setError(null);
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    if (val === "" || /^\d*\.?\d*$/.test(val)) setAmount(val);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    convert();
  };

  const displayResult = result
    ? from === to
      ? `${parseFloat(amount).toLocaleString()} ${from}`
      : `${result.converted?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${to}`
    : null;

  if (isCompact) {
    return (
      <main className="app" aria-label="Currency Converter">
        <div className={`card card--compact card--${colorScheme}`}>
          {loading && <div className="result-value compact-loading">…</div>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!loading && !error && displayResult && (
            <div className="result" aria-live="polite" aria-atomic="true">
              {result && from !== to && (
                <div className="compact-from">
                  {parseFloat(amount).toLocaleString("en-US")} {from}
                </div>
              )}
              <div className="result-value">{displayResult}</div>
              {result && from !== to && (
                <div className="rate">
                  1 {from} ={" "}
                  {result.rate?.toLocaleString("en-US", {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {to}
                </div>
              )}
              {offline && (
                <div className="offline-badge">
                  Offline — cached rates from {result.cachedDate}
                </div>
              )}
            </div>
          )}
          <Attribution />
        </div>
      </main>
    );
  }

  return (
    <main className="app" aria-label="Currency Converter">
      <div className="card">
        <h1 className="sr-only">Currency Converter</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="t">Amount</label>
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={handleAmountChange}
              onFocus={(e) => e.target.select()}
              placeholder="0"
              aria-label="Amount to convert"
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="from-currency">From</label>
              <select
                id="from-currency"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {CURRENCIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="swap"
              onClick={swap}
              aria-label="Swap currencies"
            >
              ⇄
            </button>

            <div className="field">
              <label htmlFor="to-currency">To</label>
              <select
                id="to-currency"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                {CURRENCIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="convert-btn"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Converting…" : "Convert"}
          </button>
        </form>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!error && displayResult && (
          <div className="result" aria-live="polite" aria-atomic="true">
            <div className="result-value">{displayResult}</div>
            {result && from !== to && (
              <div className="rate">
                1 {from} ={" "}
                {result.rate?.toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })}{" "}
                {to}
              </div>
            )}
            {offline ? (
              <div className="offline-badge">
                Offline — cached rates from {result.cachedDate}
              </div>
            ) : (
              <div className="source">Live rates · currency-api</div>
            )}
          </div>
        )}
        {isEmbedded && <Attribution />}
      </div>
    </main>
  );
}
