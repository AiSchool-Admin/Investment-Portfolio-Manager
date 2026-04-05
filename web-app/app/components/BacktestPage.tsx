'use client';

import { useState } from 'react';
import { runBacktest } from '../lib/engine';
import { BacktestResult, SystemSettings } from '../lib/types';
import { getAssets, getPriceList, getSystemSettings, getEffectiveSettings } from '../lib/store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

export default function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [capital, setCapital] = useState('10000');
  const [dataInfo, setDataInfo] = useState('');
  const [useAssetSettings, setUseAssetSettings] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const assets = getAssets();
  const systemSettings = getSystemSettings();

  const runBT = (prices: number[], label: string, settings: SystemSettings) => {
    setLoading(true);
    setDataInfo(`${label} (${prices.length} سجل)`);
    setTimeout(() => {
      const r = runBacktest(prices, parseFloat(capital) || 10000, settings);
      setResult(r);
      setLoading(false);
    }, 100);
  };

  const runFromAsset = (assetId: string, assetName: string) => {
    const prices = getPriceList(assetId);
    if (prices.length < 10) {
      alert(`${assetName}: لا توجد بيانات تاريخية كافية (${prices.length} سجل). استورد CSV من صفحة الأصول أولاً.`);
      return;
    }
    const asset = assets.find(a => a.id === assetId);
    const settings = useAssetSettings ? getEffectiveSettings(assetId, asset?.category) : systemSettings;
    runBT(prices, assetName, settings);
  };

  const runSample = () => runBT(generateSamplePrices(), 'بيانات مثال (180 يوم)', systemSettings);

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
        const closeCol = cols.length > 4 ? 4 : 1;
        const p = parseFloat(cols[closeCol]);
        if (!isNaN(p)) prices.push(p);
      }
      setDataInfo(`${file.name} (${prices.length} سجل)`);
      const r = runBacktest(prices, parseFloat(capital) || 10000, systemSettings);
      setResult(r);
      setLoading(false);
    };
    input.click();
  };

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
  const initialCap = parseFloat(capital) || 10000;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">الاختبار الرجعي (Backtest)</h1>
        <button className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer" onClick={() => setShowGuide(!showGuide)}>
          {showGuide ? 'إخفاء الشرح' : 'ما هو الباك تيست؟'}
        </button>
      </div>

      {/* دليل الشرح */}
      {showGuide && (
        <div className="card mb-4 text-sm" style={{ background: 'var(--primary-bg)' }}>
          <h3 className="font-bold mb-2">ما هو الاختبار الرجعي؟</h3>
          <p className="mb-2">
            هو محاكاة لتطبيق استراتيجية التداول على <b>بيانات تاريخية حقيقية</b> لمعرفة كيف كانت ستؤدي لو تم اتباعها فعلاً.
            بدلاً من المخاطرة بأموال حقيقية، نختبر الاستراتيجية على الماضي أولاً.
          </p>
          <h4 className="font-bold mb-1">كيف تعمل الاستراتيجية؟</h4>
          <ul className="list-inside list-disc space-y-1 mb-2 text-gray-600">
            <li>النظام يحسب <b>Optimum Score (OS)</b> لكل يوم بناءً على العائد والتقلب وZ-Score</li>
            <li>إذا OS ≥ {systemSettings.buyThreshold} → <span className="text-green-600 font-bold">شراء</span> (يستثمر {(systemSettings.backtestBuyRatio * 100).toFixed(0)}% من النقد المتاح)</li>
            <li>إذا OS ≤ {systemSettings.sellThreshold} → <span className="text-red-600 font-bold">بيع</span> (يبيع {(systemSettings.backtestSellRatio * 100).toFixed(0)}% من المركز)</li>
            <li>إذا {systemSettings.sellThreshold} &lt; OS &lt; {systemSettings.buyThreshold} → <span className="text-gray-500 font-bold">انتظار</span></li>
          </ul>
          <h4 className="font-bold mb-1">كيف تقرأ النتائج؟</h4>
          <ul className="list-inside list-disc space-y-1 text-gray-600">
            <li><b>عائد الاستراتيجية:</b> كم ربحت/خسرت لو اتبعت إشارات OS</li>
            <li><b>الشراء والاحتفاظ:</b> كم ربحت لو اشتريت في البداية واحتفظت (بدون تداول)</li>
            <li><b>التفوق:</b> الفرق بينهما - إيجابي يعني الاستراتيجية أفضل من الاحتفاظ</li>
            <li><b>معدل الفوز:</b> نسبة الصفقات الرابحة من إجمالي صفقات البيع</li>
            <li><b>منحنى رأس المال:</b> تطور قيمة المحفظة يومياً أثناء الاختبار</li>
          </ul>
        </div>
      )}

      <p className="text-sm text-gray-500 mb-4">اختبر استراتيجية Optimum Score على بيانات تاريخية لمعرفة أدائها قبل استخدامها فعلياً.</p>

      {/* الإعدادات */}
      <div className="card mb-6">
        <h2 className="font-bold text-lg mb-3">إعدادات الاختبار</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-bold">رأس المال الابتدائي ($)</label>
            <input className="input" type="number" value={capital} onChange={e => setCapital(e.target.value)} />
            <div className="text-xs text-gray-400 mt-0.5">المبلغ الذي تبدأ به المحاكاة</div>
          </div>
          <div className="p-3 bg-gray-50 rounded text-xs text-gray-500">
            <div>نافذة المراجعة: <b>{systemSettings.backtestLookback} يوم</b></div>
            <div>عتبة الشراء: <b>OS ≥ {systemSettings.buyThreshold}</b></div>
            <div>عتبة البيع: <b>OS ≤ {systemSettings.sellThreshold}</b></div>
            <div className="mt-1 text-gray-400">يمكن تغييرها من الإعدادات</div>
          </div>
        </div>

        {assets.length > 0 && (
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={useAssetSettings}
              onChange={e => setUseAssetSettings(e.target.checked)} className="w-4 h-4 accent-[#1B5E20]" />
            <span className="text-sm">استخدام إعدادات الأصل المخصصة (إن وجدت)</span>
          </label>
        )}

        {/* اختيار مصدر البيانات */}
        <h3 className="font-bold text-sm mb-2">اختر مصدر البيانات:</h3>

        {assets.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-1">من أصول محفوظة:</div>
            <div className="flex flex-wrap gap-2">
              {assets.map(a => {
                const count = getPriceList(a.id).length;
                return (
                  <button key={a.id}
                    className={`px-3 py-2 rounded-lg text-sm border-2 cursor-pointer transition-all ${count >= 10 ? 'border-green-300 hover:bg-green-50' : 'border-gray-200 opacity-50'}`}
                    onClick={() => runFromAsset(a.id, a.name)}
                    disabled={loading || count < 10}>
                    {a.name} ({count} سجل)
                    {count < 10 && <span className="text-red-400 mr-1">⚠</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button className="btn-primary flex-1" onClick={importCSV} disabled={loading}>📁 استيراد CSV</button>
          <button className="btn-outline flex-1" onClick={runSample} disabled={loading}>▶ بيانات مثال</button>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">جاري المحاكاة...</div>}

      {/* ============ النتائج ============ */}
      {result && !loading && (
        <>
          {dataInfo && (
            <div className="card mb-4 flex items-center gap-2" style={{ background: 'var(--primary-bg)' }}>
              <span className="font-bold">{dataInfo}</span>
            </div>
          )}

          {/* بطاقات النتائج الرئيسية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="card text-center">
              <div className="text-xs text-gray-400 mb-1">عائد الاستراتيجية</div>
              <div className={`text-xl font-bold ${result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400">
                ${(initialCap * (1 + result.totalReturn / 100)).toFixed(0)} من ${initialCap.toFixed(0)}
              </div>
            </div>
            <div className="card text-center">
              <div className="text-xs text-gray-400 mb-1">الشراء والاحتفاظ</div>
              <div className={`text-xl font-bold ${result.buyAndHoldReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {result.buyAndHoldReturn >= 0 ? '+' : ''}{result.buyAndHoldReturn.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400">لو اشتريت واحتفظت</div>
            </div>
            <div className="card text-center">
              <div className="text-xs text-gray-400 mb-1">
                {result.totalReturn > result.buyAndHoldReturn ? 'تفوق الاستراتيجية' : 'تأخر الاستراتيجية'}
              </div>
              <div className={`text-xl font-bold ${result.totalReturn > result.buyAndHoldReturn ? 'text-green-600' : 'text-red-600'}`}>
                {result.totalReturn > result.buyAndHoldReturn ? '+' : ''}{(result.totalReturn - result.buyAndHoldReturn).toFixed(2)}%
              </div>
              <div className="text-xs text-gray-400">الفرق لصالح الاستراتيجية</div>
            </div>
            <div className="card text-center">
              <div className="text-xs text-gray-400 mb-1">معدل الفوز</div>
              <div className={`text-xl font-bold ${result.winRate >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                {result.winRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400">{result.numberOfTrades} صفقة</div>
            </div>
          </div>

          {/* تفسير النتيجة */}
          <div className="card mb-4 text-sm">
            <h3 className="font-bold mb-2">تفسير النتيجة</h3>
            {result.totalReturn > result.buyAndHoldReturn ? (
              <p className="text-green-700">
                الاستراتيجية <b>تفوقت</b> على الشراء والاحتفاظ بـ {(result.totalReturn - result.buyAndHoldReturn).toFixed(2)}%.
                {result.winRate >= 50 ? ' معدل الفوز جيد.' : ' لكن معدل الفوز منخفض - قد تحتاج لضبط العتبات.'}
                {result.numberOfTrades < 3 ? ' عدد الصفقات قليل جداً - النتيجة قد لا تكون موثوقة.' : ''}
              </p>
            ) : (
              <p className="text-orange-700">
                الشراء والاحتفاظ كان <b>أفضل</b> بـ {(result.buyAndHoldReturn - result.totalReturn).toFixed(2)}%.
                {result.numberOfTrades === 0 ? ' لم تتولد أي صفقات - جرب تعديل العتبات أو زيادة البيانات.' :
                  ' جرب تعديل المعاملات (α, β, γ) أو عتبات الشراء/البيع من الإعدادات.'}
              </p>
            )}
            {result.numberOfTrades > 0 && (
              <div className="mt-2 text-gray-500">
                تم تنفيذ <b>{result.trades.filter(t => t.type === 'buy').length}</b> عمليات شراء
                و <b>{result.trades.filter(t => t.type === 'sell').length}</b> عمليات بيع
                خلال فترة الاختبار.
              </div>
            )}
          </div>

          {/* منحنى رأس المال */}
          {chartData.length > 1 && (
            <div className="card mb-4">
              <h2 className="font-bold mb-1">منحنى رأس المال</h2>
              <p className="text-xs text-gray-400 mb-3">تطور قيمة المحفظة يومياً. الخط الأفقي المنقط = رأس المال الابتدائي.</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} label={{ value: 'اليوم', position: 'insideBottom', offset: -2, style: { fontSize: 11 } }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [`$${Number(v).toFixed(2)}`, 'القيمة']}
                    labelFormatter={(l) => `اليوم ${l}`} />
                  <ReferenceLine y={initialCap} stroke="#999" strokeDasharray="5 5" label={{ value: 'الابتدائي', position: 'insideTopLeft', style: { fontSize: 10, fill: '#999' } }} />
                  <Line type="monotone" dataKey="value" stroke="#1B5E20" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* جدول الصفقات */}
          {result.trades.length > 0 && (
            <div className="card mb-4">
              <h2 className="font-bold mb-1">سجل الصفقات ({result.trades.length})</h2>
              <p className="text-xs text-gray-400 mb-3">كل عمليات الشراء والبيع التي نفذتها الاستراتيجية أثناء المحاكاة.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="text-right py-1.5 px-2">النوع</th>
                      <th className="text-right py-1.5 px-2">اليوم</th>
                      <th className="text-right py-1.5 px-2">السعر</th>
                      <th className="text-right py-1.5 px-2">الكمية</th>
                      <th className="text-right py-1.5 px-2">القيمة</th>
                      <th className="text-right py-1.5 px-2">OS</th>
                      <th className="text-right py-1.5 px-2">السبب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.slice(0, 30).map((t, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className={`py-1.5 px-2 font-bold ${t.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.type === 'buy' ? '↓ شراء' : '↑ بيع'}
                        </td>
                        <td className="py-1.5 px-2 text-gray-500">{t.dayIndex}</td>
                        <td className="py-1.5 px-2">${t.price.toFixed(2)}</td>
                        <td className="py-1.5 px-2">{t.quantity.toFixed(4)}</td>
                        <td className="py-1.5 px-2 font-bold">${t.value.toFixed(2)}</td>
                        <td className="py-1.5 px-2">{(t.os * 100).toFixed(0)}%</td>
                        <td className="py-1.5 px-2 text-xs text-gray-400">
                          {t.type === 'buy'
                            ? `OS ≥ ${systemSettings.buyThreshold} → شراء`
                            : `OS ≤ ${systemSettings.sellThreshold} → بيع`
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.trades.length > 30 && (
                <div className="text-xs text-gray-400 text-center mt-2">
                  عرض أول 30 صفقة من {result.trades.length}. صدّر CSV للتفاصيل الكاملة.
                </div>
              )}
            </div>
          )}

          <button className="btn-primary w-full" onClick={exportCSV}>📥 تصدير التقرير الكامل (CSV)</button>
        </>
      )}

      {/* حالة عدم وجود نتائج */}
      {!result && !loading && (
        <div className="text-center text-gray-400 py-8">
          <div className="text-4xl mb-3">📈</div>
          <div>اختر مصدر بيانات أعلاه لبدء الاختبار</div>
        </div>
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
