'use client';

import { useState } from 'react';
import { runBacktest } from '../lib/engine';
import { BacktestResult } from '../lib/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [capital, setCapital] = useState('10000');
  const [lookback, setLookback] = useState('50');
  const [alpha, setAlpha] = useState('0.4');
  const [beta, setBeta] = useState('0.4');
  const [gamma, setGamma] = useState('0.2');
  const [dataInfo, setDataInfo] = useState('');

  // بيانات مثال
  const runSample = () => {
    setLoading(true);
    const prices = generateSamplePrices();
    setDataInfo(`بيانات مثال (AAPL - ${prices.length} يوم)`);
    setTimeout(() => {
      const r = runBacktest(prices, parseFloat(capital) || 10000, 0.03, 0.001,
        parseInt(lookback) || 50, parseFloat(alpha) || 0.4, parseFloat(beta) || 0.4, parseFloat(gamma) || 0.2);
      setResult(r);
      setLoading(false);
    }, 100);
  };

  // استيراد CSV
  const importCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setLoading(true);
      const text = await file.text();
      const lines = text.trim().split('\n');
      const prices: number[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const closeCol = cols.length > 4 ? 4 : 1; // Date,Open,High,Low,Close or Date,Close
        const p = parseFloat(cols[closeCol]);
        if (!isNaN(p)) prices.push(p);
      }
      setDataInfo(`${file.name} (${prices.length} سجل)`);
      const r = runBacktest(prices, parseFloat(capital) || 10000, 0.03, 0.001,
        parseInt(lookback) || 50, parseFloat(alpha) || 0.4, parseFloat(beta) || 0.4, parseFloat(gamma) || 0.2);
      setResult(r);
      setLoading(false);
    };
    input.click();
  };

  // تصدير النتائج
  const exportCSV = () => {
    if (!result) return;
    let csv = 'النوع,السعر,الكمية,القيمة,اليوم,OS\n';
    result.trades.forEach(t => {
      csv += `${t.type === 'buy' ? 'شراء' : 'بيع'},${t.price.toFixed(2)},${t.quantity.toFixed(6)},${t.value.toFixed(2)},${t.dayIndex},${t.os.toFixed(4)}\n`;
    });
    csv += `\nالعائد الإجمالي,${result.totalReturn.toFixed(2)}%\n`;
    csv += `عائد الشراء والاحتفاظ,${result.buyAndHoldReturn.toFixed(2)}%\n`;
    csv += `عدد الصفقات,${result.numberOfTrades}\n`;
    csv += `معدل الفوز,${result.winRate.toFixed(1)}%\n`;

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'backtest_report.csv'; a.click();
  };

  const chartData = result?.equityCurve.map((v, i) => ({ day: i, value: v })) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">الباك تيست</h1>

      {/* الإعدادات */}
      <div className="card mb-6">
        <h2 className="font-bold text-lg mb-4">إعدادات الاختبار</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="text-xs font-bold">رأس المال ($)</label>
            <input className="input" type="number" value={capital} onChange={e => setCapital(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold">نافذة المراجعة (يوم)</label>
            <input className="input" type="number" value={lookback} onChange={e => setLookback(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold">α (شارب)</label>
            <input className="input" type="number" step="0.1" value={alpha} onChange={e => setAlpha(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold">β (Z-Score)</label>
            <input className="input" type="number" step="0.1" value={beta} onChange={e => setBeta(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold">γ (تكلفة)</label>
            <input className="input" type="number" step="0.1" value={gamma} onChange={e => setGamma(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary flex-1" onClick={importCSV} disabled={loading}>📁 استيراد CSV</button>
          <button className="btn-outline flex-1" onClick={runSample} disabled={loading}>▶ بيانات مثال</button>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">جاري الحساب...</div>}

      {result && !loading && (
        <>
          {dataInfo && (
            <div className="card mb-4 flex items-center gap-2" style={{ background: 'var(--primary-bg)' }}>
              <span>ℹ️</span> <span className="font-bold">{dataInfo}</span>
            </div>
          )}

          {/* النتائج */}
          <div className="card mb-4">
            <h2 className="font-bold text-lg mb-4">النتائج</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span>العائد (الاستراتيجية):</span>
                <b className={result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {result.totalReturn.toFixed(2)}%
                </b>
              </div>
              <div className="flex justify-between">
                <span>الشراء والاحتفاظ:</span>
                <b className={result.buyAndHoldReturn >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {result.buyAndHoldReturn.toFixed(2)}%
                </b>
              </div>
              <div className="flex justify-between">
                <span>التفوق:</span>
                <b className={result.totalReturn > result.buyAndHoldReturn ? 'text-green-600' : 'text-red-600'}>
                  {(result.totalReturn - result.buyAndHoldReturn).toFixed(2)}%
                </b>
              </div>
              <div className="flex justify-between"><span>عدد الصفقات:</span><b>{result.numberOfTrades}</b></div>
              <div className="flex justify-between"><span>معدل الفوز:</span><b>{result.winRate.toFixed(1)}%</b></div>
            </div>
          </div>

          {/* الرسم البياني */}
          {chartData.length > 1 && (
            <div className="card mb-4">
              <h2 className="font-bold mb-3">منحنى رأس المال</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" label={{ value: 'اليوم', position: 'bottom' }} />
                  <YAxis />
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                  <Line type="monotone" dataKey="value" stroke="#1B5E20" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* الصفقات */}
          {result.trades.length > 0 && (
            <div className="card mb-4">
              <h2 className="font-bold mb-3">الصفقات ({result.trades.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-right py-1 px-2">النوع</th>
                      <th className="text-right py-1 px-2">السعر</th>
                      <th className="text-right py-1 px-2">الكمية</th>
                      <th className="text-right py-1 px-2">القيمة</th>
                      <th className="text-right py-1 px-2">OS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 20).map((t, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className={`py-1 px-2 font-bold ${t.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'buy' ? '↓ شراء' : '↑ بيع'}
                        </td>
                        <td className="py-1 px-2">${t.price.toFixed(2)}</td>
                        <td className="py-1 px-2">{t.quantity.toFixed(4)}</td>
                        <td className="py-1 px-2">${t.value.toFixed(2)}</td>
                        <td className="py-1 px-2">{t.os.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button className="btn-primary w-full" onClick={exportCSV}>📥 تصدير النتائج (CSV)</button>
        </>
      )}
    </div>
  );
}

function generateSamplePrices(): number[] {
  const changes = [0.02,-0.01,0.015,-0.005,0.01,0.025,-0.02,0.005,0.01,-0.015,0.03,-0.01,0.02,-0.025,0.015,0.005,-0.01,0.02,-0.005,0.01];
  const prices: number[] = [];
  let price = 150;
  for (let i = 0; i < 180; i++) {
    prices.push(price);
    price *= (1 + changes[i % changes.length]);
  }
  return prices;
}
