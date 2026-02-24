import { useState, useCallback } from "react";
import "./App.css";

const CACHE_KEY = "fx_cache";

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

export default function App() {
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState("JPY");
  const [to, setTo] = useState("CZK");
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

  const displayResult = result
    ? from === to
      ? `${parseFloat(amount).toLocaleString()} ${from}`
      : `${result.converted?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${to}`
    : null;

  return (
    <div className="app">
      <div className="card">
        <div className="field">
          <label>Amount</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0"
          />
        </div>

        <div className="row">
          <div className="field">
            <label>From</label>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              {CURRENCIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </div>

          <button className="swap" onClick={swap} title="Swap currencies">
            ⇄
          </button>

          <div className="field">
            <label>To</label>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {CURRENCIES.map(([code, name]) => (
                <option key={code} value={code}>
                  {code} — {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="convert-btn" onClick={convert} disabled={loading}>
          {loading ? "Converting..." : "Convert"}
        </button>

        {error && <p className="error">{error}</p>}

        {!error && displayResult && (
          <div className="result">
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
      </div>
    </div>
  );
}
