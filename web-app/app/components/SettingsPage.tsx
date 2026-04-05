'use client';

import { useState } from 'react';
import { getProfile, saveProfile, getTrades, getAssets, getSystemSettings, saveSystemSettings, resetSystemSettings, getAssetSettings, saveAssetSettings, deleteAssetSettings, downloadDataAsFile, importDataFromFile } from '../lib/store';
import { PROFILE_NAMES, SystemSettings, AssetSettings, SETTINGS_META, DEFAULT_SYSTEM_SETTINGS, getAssetClassDefaults, getAssetClassCode } from '../lib/types';

const SELL_MODES = [
  { value: 'rebalance', label: 'إعادة توازن' },
  { value: 'half', label: 'نصف المركز' },
  { value: 'quarter', label: 'ربع المركز' },
  { value: 'all', label: 'كامل المركز' },
] as const;

export default function SettingsPage() {
  const [profile, setProfile] = useState(getProfile);
  const [cash, setCash] = useState(profile?.availableCash?.toString() || '0');
  const [settings, setSettings] = useState<SystemSettings>(getSystemSettings);
  const [activeTab, setActiveTab] = useState<'profile' | 'system' | 'assets' | 'trades' | 'data' | 'about'>('system');
  const [importStatus, setImportStatus] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assetOverrides, setAssetOverrides] = useState<AssetSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const trades = getTrades();
  const assets = getAssets();

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateCash = () => {
    if (profile) {
      const updated = { ...profile, availableCash: parseFloat(cash) || 0 };
      saveProfile(updated);
      setProfile(updated);
      showSaved();
    }
  };

  const updateProfileWeights = (key: string, value: number) => {
    if (profile) {
      const updated = { ...profile, [key]: value, profileType: 'custom' as const };
      saveProfile(updated);
      setProfile(updated);
    }
  };

  const handleSettingChange = (key: keyof SystemSettings, value: number | string) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSystemSettings(updated);
    showSaved();
  };

  const handleResetSettings = () => {
    if (confirm('هل تريد استعادة الإعدادات الافتراضية؟')) {
      resetSystemSettings();
      setSettings({ ...DEFAULT_SYSTEM_SETTINGS });
      showSaved();
    }
  };

  // إعدادات الأصل الفردي
  const loadAssetOverrides = (assetId: string) => {
    setSelectedAssetId(assetId);
    const existing = getAssetSettings(assetId);
    setAssetOverrides(existing || { assetId });
  };

  const handleAssetSettingChange = (key: keyof AssetSettings, value: number | string | undefined) => {
    if (!assetOverrides) return;
    const updated = { ...assetOverrides, [key]: value };
    setAssetOverrides(updated);
    saveAssetSettings(updated);
    showSaved();
  };

  const clearAssetOverrides = () => {
    if (selectedAssetId) {
      deleteAssetSettings(selectedAssetId);
      setAssetOverrides({ assetId: selectedAssetId });
      showSaved();
    }
  };

  const weights = profile ? [
    { key: 'stocksWeight', label: 'أسهم', value: profile.stocksWeight },
    { key: 'cryptoWeight', label: 'عملات رقمية', value: profile.cryptoWeight },
    { key: 'bondsWeight', label: 'سندات', value: profile.bondsWeight },
    { key: 'commoditiesWeight', label: 'سلع', value: profile.commoditiesWeight },
    { key: 'realEstateWeight', label: 'عقارات', value: profile.realEstateWeight },
    { key: 'cashWeight', label: 'نقد', value: profile.cashWeight },
  ] : [];

  // تجميع الإعدادات حسب المجموعة
  const groupedSettings: Record<string, typeof SETTINGS_META> = {};
  for (const meta of SETTINGS_META) {
    if (!groupedSettings[meta.group]) groupedSettings[meta.group] = [];
    groupedSettings[meta.group].push(meta);
  }

  const TABS = [
    { id: 'data', label: 'نسخ احتياطي', icon: '💾' },
    { id: 'system', label: 'إعدادات النظام', icon: '🔧' },
    { id: 'assets', label: 'إعدادات الأصول', icon: '📊' },
    { id: 'profile', label: 'الملف الاستثماري', icon: '👤' },
    { id: 'trades', label: 'سجل الصفقات', icon: '📋' },
    { id: 'about', label: 'حول', icon: 'ℹ️' },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        {saved && (
          <span className="text-green-600 text-sm font-bold animate-pulse">تم الحفظ تلقائياً ✓</span>
        )}
      </div>

      {/* التبويبات */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap cursor-pointer transition-all ${
              activeTab === t.id ? 'font-bold text-white' : 'hover:bg-gray-100'
            }`}
            style={activeTab === t.id ? { background: 'var(--primary)' } : {}}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ============ إعدادات النظام ============ */}
      {activeTab === 'system' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">تحكم في جميع معاملات النظام. التغييرات تُحفظ تلقائياً.</p>
            <button className="btn-outline text-xs" onClick={handleResetSettings}>استعادة الافتراضية</button>
          </div>

          {/* تفعيل Trailing Stop */}
          <div className="card mb-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="font-bold">وقف الخسارة المتحرك (Trailing Stop)</span>
                <div className="text-xs text-gray-400">عند تحقيق ربح كبير، يحمي الأرباح تلقائياً</div>
              </div>
              <input type="checkbox" className="w-5 h-5 accent-[#1B5E20]"
                checked={settings.trailingStopEnabled}
                onChange={e => handleSettingChange('trailingStopEnabled' as keyof SystemSettings, e.target.checked as unknown as number)} />
            </label>
          </div>

          {/* مجموع أوزان OS */}
          {(() => {
            const sum = settings.alpha + settings.beta + settings.delta + settings.epsilon + settings.zeta + settings.eta + settings.gamma;
            return (
              <div className={`text-xs text-center font-bold mb-2 ${Math.abs(sum - 1) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                مجموع أوزان OS: {sum.toFixed(2)} {Math.abs(sum - 1) >= 0.01 && '(يجب أن يكون 1.00)'}
              </div>
            );
          })()}

          {Object.entries(groupedSettings).map(([group, metas]) => (
            <div key={group} className="card mb-4">
              <h3 className="font-bold text-lg mb-3 pb-2 border-b border-border">{group}</h3>
              <div className="flex flex-col gap-4">
                {metas.map(meta => (
                  <SettingControl
                    key={meta.key}
                    meta={meta}
                    value={settings[meta.key] as number | string}
                    defaultValue={DEFAULT_SYSTEM_SETTINGS[meta.key] as number | string}
                    onChange={(v) => handleSettingChange(meta.key, v)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ إعدادات الأصول الفردية ============ */}
      {activeTab === 'assets' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">خصص معاملات كل أصل بشكل مستقل. القيم غير المحددة تستخدم إعدادات النظام.</p>

          {assets.length === 0 ? (
            <div className="card text-center text-gray-400 py-8">لا توجد أصول. أضف أصولاً أولاً.</div>
          ) : (
            <>
              {/* قائمة الأصول */}
              <div className="flex flex-wrap gap-2 mb-4">
                {assets.map(a => {
                  const hasOverrides = getAssetSettings(a.id) !== null;
                  return (
                    <button
                      key={a.id}
                      onClick={() => loadAssetOverrides(a.id)}
                      className={`px-4 py-2 rounded-lg text-sm border-2 cursor-pointer transition-all ${
                        selectedAssetId === a.id
                          ? 'border-blue-500 bg-blue-50 font-bold'
                          : hasOverrides
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {a.name}
                      {hasOverrides && <span className="mr-1 text-green-600 text-xs">(مخصص)</span>}
                    </button>
                  );
                })}
              </div>

              {/* تفاصيل إعدادات الأصل */}
              {selectedAssetId && assetOverrides && (() => {
                const selectedAsset = assets.find(a => a.id === selectedAssetId);
                const classCode = selectedAsset ? getAssetClassCode(selectedAsset.category) : 'EQ';
                const classDefaults = selectedAsset ? getAssetClassDefaults(selectedAsset.category) : getAssetClassDefaults('أسهم محلية');
                return (
                <div className="card">
                  {/* معلومات الفئة */}
                  <div className="mb-3 p-2 rounded bg-blue-50 text-xs text-blue-700">
                    فئة الأصل: <b>{selectedAsset?.category}</b> → كود: <b>{classCode}</b> |
                    الأوزان الافتراضية: α={classDefaults.alpha} β={classDefaults.beta} δ={classDefaults.delta} ε={classDefaults.epsilon} ζ={classDefaults.zeta} η={classDefaults.eta} γ={classDefaults.gamma}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg">
                      إعدادات {selectedAsset?.name}
                    </h3>
                    <button className="btn-outline text-xs" onClick={clearAssetOverrides}>
                      مسح التخصيصات
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 mb-4">
                    فعّل التخصيص لأي معامل بتغيير قيمته. القيم الفارغة تستخدم إعدادات النظام.
                  </p>

                  <div className="flex flex-col gap-4">
                    {/* Alpha */}
                    <AssetSettingRow
                      label="α وزن شارب"
                      systemValue={settings.alpha}
                      overrideValue={assetOverrides.alpha}
                      step={0.05} min={0} max={1}
                      onChange={(v) => handleAssetSettingChange('alpha', v)}
                    />
                    {/* Beta */}
                    <AssetSettingRow
                      label="β وزن Z-Score"
                      systemValue={settings.beta}
                      overrideValue={assetOverrides.beta}
                      step={0.05} min={0} max={1}
                      onChange={(v) => handleAssetSettingChange('beta', v)}
                    />
                    {/* Gamma */}
                    <AssetSettingRow
                      label="γ وزن التكلفة"
                      systemValue={settings.gamma}
                      overrideValue={assetOverrides.gamma}
                      step={0.05} min={0} max={1}
                      onChange={(v) => handleAssetSettingChange('gamma', v)}
                    />
                    {/* Buy Threshold */}
                    <AssetSettingRow
                      label="عتبة الشراء"
                      systemValue={settings.buyThreshold}
                      overrideValue={assetOverrides.buyThreshold}
                      step={0.05} min={0.5} max={0.95}
                      onChange={(v) => handleAssetSettingChange('buyThreshold', v)}
                    />
                    {/* Sell Threshold */}
                    <AssetSettingRow
                      label="عتبة البيع"
                      systemValue={settings.sellThreshold}
                      overrideValue={assetOverrides.sellThreshold}
                      step={0.05} min={0.05} max={0.5}
                      onChange={(v) => handleAssetSettingChange('sellThreshold', v)}
                    />
                    {/* Risk Free Rate */}
                    <AssetSettingRow
                      label="العائد الخالي من المخاطر"
                      systemValue={settings.riskFreeRate}
                      overrideValue={assetOverrides.riskFreeRate}
                      step={0.005} min={0} max={0.2}
                      onChange={(v) => handleAssetSettingChange('riskFreeRate', v)}
                      isPercent
                    />
                    {/* Transaction Cost */}
                    <AssetSettingRow
                      label="تكلفة المعاملات"
                      systemValue={settings.transactionCost}
                      overrideValue={assetOverrides.transactionCost}
                      step={0.0005} min={0} max={0.05}
                      onChange={(v) => handleAssetSettingChange('transactionCost', v)}
                      isPercent
                    />
                    {/* Cash Ratio */}
                    <AssetSettingRow
                      label="نسبة النقد للشراء"
                      systemValue={settings.buyOrderCashRatio}
                      overrideValue={assetOverrides.buyOrderCashRatio}
                      step={0.05} min={0.05} max={1}
                      onChange={(v) => handleAssetSettingChange('buyOrderCashRatio', v)}
                      isPercent
                    />
                    {/* Z-Score Strong Buy */}
                    <AssetSettingRow
                      label="Z-Score شراء قوي"
                      systemValue={settings.zScoreStrongBuy}
                      overrideValue={assetOverrides.zScoreStrongBuy}
                      step={0.5} min={-5} max={0}
                      onChange={(v) => handleAssetSettingChange('zScoreStrongBuy', v)}
                    />
                    {/* Z-Score Strong Sell */}
                    <AssetSettingRow
                      label="Z-Score بيع قوي"
                      systemValue={settings.zScoreStrongSell}
                      overrideValue={assetOverrides.zScoreStrongSell}
                      step={0.5} min={0} max={5}
                      onChange={(v) => handleAssetSettingChange('zScoreStrongSell', v)}
                    />
                    {/* Sell Mode */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-bold">أسلوب البيع</div>
                        <div className="text-xs text-gray-400">النظام: {SELL_MODES.find(m => m.value === settings.sellMode)?.label}</div>
                      </div>
                      <select
                        className="input w-40"
                        value={assetOverrides.sellMode || ''}
                        onChange={e => handleAssetSettingChange('sellMode', e.target.value || undefined)}
                      >
                        <option value="">استخدام النظام</option>
                        {SELL_MODES.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ============ الملف الاستثماري ============ */}
      {activeTab === 'profile' && profile && (
        <div>
          {/* درجة المخاطر والنمط */}
          <div className="card mb-4">
            <h2 className="font-bold text-lg mb-3">نمط الاستثمار</h2>

            <div className="mb-4">
              <label className="text-sm font-bold block mb-2">درجة تحمل المخاطر: {profile.riskScore}/10</label>
              <input
                type="range"
                className="w-full accent-[#1B5E20]"
                min="1" max="10" step="1"
                value={profile.riskScore}
                onChange={e => {
                  const score = parseInt(e.target.value);
                  const type = score >= 8 ? 'aggressive' : score >= 5 ? 'balanced' : score >= 3 ? 'income' : 'capital_preservation';
                  const updated = { ...profile, riskScore: score, profileType: type as typeof profile.profileType };
                  saveProfile(updated);
                  setProfile(updated);
                }}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1 - حذر جداً</span>
                <span>10 - مغامر جداً</span>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-sm font-bold block mb-2">النمط الاستثماري</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(PROFILE_NAMES).map(([key, label]) => (
                  <button
                    key={key}
                    className={`p-3 rounded-lg border-2 text-sm text-center cursor-pointer transition-all ${
                      profile.profileType === key
                        ? 'border-green-500 bg-green-50 font-bold'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      const presets: Record<string, Partial<typeof profile>> = {
                        aggressive: { stocksWeight: 0.50, cryptoWeight: 0.25, bondsWeight: 0.05, commoditiesWeight: 0.10, realEstateWeight: 0.05, cashWeight: 0.05, riskScore: 9 },
                        balanced: { stocksWeight: 0.35, cryptoWeight: 0.10, bondsWeight: 0.25, commoditiesWeight: 0.10, realEstateWeight: 0.10, cashWeight: 0.10, riskScore: 6 },
                        income: { stocksWeight: 0.20, cryptoWeight: 0.05, bondsWeight: 0.40, commoditiesWeight: 0.05, realEstateWeight: 0.15, cashWeight: 0.15, riskScore: 3 },
                        capital_preservation: { stocksWeight: 0.10, cryptoWeight: 0.00, bondsWeight: 0.50, commoditiesWeight: 0.05, realEstateWeight: 0.10, cashWeight: 0.25, riskScore: 1 },
                        custom: {},
                      };
                      const preset = presets[key] || {};
                      const updated = { ...profile, ...preset, profileType: key as typeof profile.profileType };
                      saveProfile(updated);
                      setProfile(updated);
                      showSaved();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* التوزيع المستهدف */}
          <div className="card mb-4">
            <h2 className="font-bold text-lg mb-3">التوزيع المستهدف</h2>
            {weights.map(w => (
              <div key={w.key} className="flex items-center gap-2 mb-2">
                <span className="w-24 text-sm">{w.label}</span>
                <input
                  type="range"
                  className="flex-1 accent-[#1B5E20]"
                  min="0" max="100" step="1"
                  value={Math.round(w.value * 100)}
                  onChange={e => updateProfileWeights(w.key, parseInt(e.target.value) / 100)}
                />
                <span className="text-sm font-bold w-12 text-left">{(w.value * 100).toFixed(0)}%</span>
              </div>
            ))}
            {weights.length > 0 && (
              <div className={`text-xs text-center font-bold mt-1 ${
                Math.abs(weights.reduce((s, w) => s + w.value, 0) - 1) < 0.01
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                المجموع: {(weights.reduce((s, w) => s + w.value, 0) * 100).toFixed(0)}%
                {Math.abs(weights.reduce((s, w) => s + w.value, 0) - 1) >= 0.01 && ' (يجب أن يكون 100%)'}
              </div>
            )}
          </div>

          {/* النقد المتاح */}
          <div className="card mb-4">
            <h2 className="font-bold text-lg mb-3">النقد المتاح</h2>
            <div className="flex gap-2">
              <input className="input flex-1" type="number" value={cash} onChange={e => setCash(e.target.value)}
                placeholder="النقد المتاح" />
              <button className="btn-primary text-sm" onClick={updateCash}>تحديث</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ سجل الصفقات ============ */}
      {activeTab === 'trades' && (
        <div className="card mb-4">
          <h2 className="font-bold text-lg mb-3">سجل الصفقات ({trades.length})</h2>
          {trades.length === 0 ? (
            <div className="text-gray-400 text-sm">لا توجد صفقات مسجلة</div>
          ) : (
            trades.slice(0, 50).map(t => (
              <div key={t.id} className="flex items-center gap-2 py-2 border-b border-gray-50 text-sm">
                <span className={`font-bold ${t.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'buy' ? '↓' : '↑'}
                </span>
                <span className="flex-1">
                  {t.type === 'buy' ? 'شراء' : 'بيع'} {t.assetName} - {t.quantity.toFixed(4)} @ ${t.price.toFixed(2)}
                </span>
                <span className="text-gray-400 text-xs">{t.date}</span>
                <span className="font-bold">${t.totalValue.toFixed(2)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ============ نسخ احتياطي ============ */}
      {activeTab === 'data' && (
        <div>
          <div className="card mb-4" style={{ background: 'var(--warning-bg)' }}>
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div className="text-sm">
                <b>مهم:</b> بياناتك محفوظة في المتصفح فقط (localStorage). عند تغيير عنوان الموقع أو مسح بيانات المتصفح ستفقد بياناتك.
                <b> احفظ نسخة احتياطية بانتظام.</b>
              </div>
            </div>
          </div>

          {/* تصدير */}
          <div className="card mb-4">
            <h2 className="font-bold text-lg mb-2">تصدير البيانات</h2>
            <p className="text-sm text-gray-500 mb-3">حفظ جميع بياناتك (أصول، إعدادات، صفقات، خطط) في ملف JSON واحد.</p>
            <button className="btn-primary w-full text-lg py-3" onClick={downloadDataAsFile}>
              💾 تحميل نسخة احتياطية
            </button>
          </div>

          {/* استيراد */}
          <div className="card mb-4">
            <h2 className="font-bold text-lg mb-2">استيراد البيانات</h2>
            <p className="text-sm text-gray-500 mb-3">استعادة بياناتك من ملف نسخة احتياطية سابقة. سيتم استبدال البيانات الحالية.</p>
            <button className="btn-outline w-full text-lg py-3" onClick={async () => {
              const result = await importDataFromFile();
              setImportStatus(result.message);
              if (result.success) {
                setProfile(getProfile());
                setSettings(getSystemSettings());
                showSaved();
                setTimeout(() => window.location.reload(), 1500);
              }
            }}>
              📂 استيراد من ملف
            </button>
            {importStatus && (
              <div className={`text-sm text-center font-bold mt-2 ${importStatus.includes('بنجاح') ? 'text-green-600' : 'text-red-600'}`}>
                {importStatus}
              </div>
            )}
          </div>

          {/* معلومات التخزين */}
          <div className="card">
            <h2 className="font-bold text-lg mb-2">حالة التخزين</h2>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>الأصول:</span><b>{assets.length} أصل</b></div>
              <div className="flex justify-between"><span>الصفقات:</span><b>{trades.length} صفقة</b></div>
              <div className="flex justify-between"><span>النقد المتاح:</span><b>${profile?.availableCash?.toFixed(2) || '0'}</b></div>
              <div className="flex justify-between"><span>نوع التخزين:</span><b>محلي (localStorage)</b></div>
            </div>
          </div>
        </div>
      )}

      {/* ============ حول التطبيق ============ */}
      {activeTab === 'about' && (
        <div className="card">
          <h2 className="font-bold text-lg mb-3">حول التطبيق</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span>الإصدار:</span><b>2.0.0 (Web)</b></div>
            <div className="flex justify-between"><span>المحرك:</span><b>Optimum Score Engine v2 (ديناميكي)</b></div>
            <div className="flex justify-between"><span>التخزين:</span><b>محلي (localStorage)</b></div>
            <div className="flex justify-between"><span>الاتصال:</span><b>بدون إنترنت - بيانات محلية</b></div>
          </div>
          <div className="text-xs text-gray-400 mt-3">
            تطبيق المدير الديناميكي للمحفظة الاستثمارية. يعتمد على نموذج Optimum Score
            لتوليد إشارات شراء وبيع. جميع البيانات مخزنة محلياً في متصفحك.
            جميع المعاملات قابلة للتخصيص على مستوى النظام أو على مستوى كل أصل.
          </div>
        </div>
      )}
    </div>
  );
}

// ============ مكون التحكم في إعداد واحد ============

function SettingControl({ meta, value, defaultValue, onChange }: {
  meta: typeof SETTINGS_META[number];
  value: number | string;
  defaultValue: number | string;
  onChange: (v: number | string) => void;
}) {
  const isDefault = value === defaultValue;

  // أسلوب البيع - قائمة منسدلة
  if (meta.key === 'sellMode') {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <div>
            <span className="text-sm font-bold">{meta.label}</span>
            {!isDefault && <span className="text-xs text-orange-500 mr-1">(معدّل)</span>}
          </div>
        </div>
        <div className="text-xs text-gray-400 mb-1">{meta.description}</div>
        <select
          className="input"
          value={value as string}
          onChange={e => onChange(e.target.value)}
        >
          {[
            { value: 'rebalance', label: 'إعادة توازن' },
            { value: 'half', label: 'نصف المركز' },
            { value: 'quarter', label: 'ربع المركز' },
            { value: 'all', label: 'كامل المركز' },
          ].map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
    );
  }

  const numValue = typeof value === 'number' ? value : parseFloat(value as string);
  const isPercent = meta.unit === '%';
  const displayValue = isPercent ? (numValue * 100).toFixed(2) : numValue;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-sm font-bold">{meta.label}</span>
          {!isDefault && <span className="text-xs text-orange-500 mr-1">(معدّل)</span>}
        </div>
        <div className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
          {isPercent ? `${displayValue}%` : displayValue}
          {meta.unit && meta.unit !== '%' && ` ${meta.unit}`}
        </div>
      </div>
      <div className="text-xs text-gray-400 mb-1">{meta.description}</div>
      <input
        type="range"
        className="w-full accent-[#1B5E20]"
        min={meta.min}
        max={meta.max}
        step={meta.step}
        value={numValue}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <div className="flex justify-between text-xs text-gray-300">
        <span>{isPercent ? `${(meta.min * 100).toFixed(1)}%` : meta.min}</span>
        <span>{isPercent ? `${(meta.max * 100).toFixed(1)}%` : meta.max}</span>
      </div>
    </div>
  );
}

// ============ صف إعداد أصل فردي ============

function AssetSettingRow({ label, systemValue, overrideValue, step, min, max, onChange, isPercent }: {
  label: string;
  systemValue: number;
  overrideValue: number | undefined;
  step: number; min: number; max: number;
  onChange: (v: number | undefined) => void;
  isPercent?: boolean;
}) {
  const isOverridden = overrideValue !== undefined;
  const currentValue = overrideValue ?? systemValue;
  const displayVal = isPercent ? (currentValue * 100).toFixed(2) + '%' : currentValue.toFixed(4);
  const sysDisplay = isPercent ? (systemValue * 100).toFixed(2) + '%' : systemValue;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{label}</span>
          {isOverridden && <span className="text-xs text-orange-500">(مخصص)</span>}
        </div>
        <div className="text-xs text-gray-400">النظام: {sysDisplay}</div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="input w-24 text-sm"
          step={step} min={min} max={max}
          value={isOverridden ? overrideValue : ''}
          placeholder={String(systemValue)}
          onChange={e => {
            const val = e.target.value;
            if (val === '') onChange(undefined);
            else onChange(parseFloat(val));
          }}
        />
        <span className="text-xs text-gray-500 w-16">{displayVal}</span>
      </div>
    </div>
  );
}
