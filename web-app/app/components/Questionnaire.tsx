'use client';

import { useState } from 'react';
import { InvestorProfile } from '../lib/types';
import { saveProfile, loadSampleData } from '../lib/store';

const QUESTIONS = [
  {
    q: 'ما هو هدفك الاستثماري الأساسي؟',
    opts: [
      { text: 'الحفاظ على رأس المال', score: 1 },
      { text: 'تحقيق دخل ثابت', score: 3 },
      { text: 'نمو متوازن', score: 6 },
      { text: 'نمو عنيف وتعظيم العوائد', score: 9 },
    ],
  },
  {
    q: 'ما هو أفقك الزمني للاستثمار؟',
    opts: [
      { text: 'أقل من سنة', score: 1 },
      { text: '1-3 سنوات', score: 3 },
      { text: '3-7 سنوات', score: 6 },
      { text: 'أكثر من 7 سنوات', score: 9 },
    ],
  },
  {
    q: 'كيف تتصرف إذا انخفضت محفظتك 20%؟',
    opts: [
      { text: 'أبيع كل شيء فوراً', score: 1 },
      { text: 'أبيع جزءاً لتقليل الخسائر', score: 3 },
      { text: 'أنتظر التعافي', score: 6 },
      { text: 'أشتري المزيد (فرصة)', score: 9 },
    ],
  },
  {
    q: 'ما نسبة دخلك التي يمكنك تحمل خسارتها؟',
    opts: [
      { text: 'لا أتحمل أي خسارة', score: 1 },
      { text: 'حتى 5%', score: 3 },
      { text: 'حتى 15%', score: 6 },
      { text: 'أكثر من 15%', score: 9 },
    ],
  },
  {
    q: 'ما خبرتك في الاستثمار؟',
    opts: [
      { text: 'مبتدئ تماماً', score: 1 },
      { text: 'خبرة محدودة (1-2 سنة)', score: 3 },
      { text: 'خبرة متوسطة (3-5 سنوات)', score: 6 },
      { text: 'خبرة واسعة (أكثر من 5 سنوات)', score: 9 },
    ],
  },
  {
    q: 'ما رأيك في العملات الرقمية؟',
    opts: [
      { text: 'مخاطرة عالية لا أريدها', score: 1 },
      { text: 'نسبة صغيرة جداً للتنويع', score: 3 },
      { text: 'جزء معقول من المحفظة', score: 6 },
      { text: 'فرصة كبيرة للنمو', score: 9 },
    ],
  },
  {
    q: 'أيهما تفضل؟',
    opts: [
      { text: 'عوائد مضمونة 3% سنوياً', score: 1 },
      { text: 'عوائد محتملة 8% مع مخاطر قليلة', score: 3 },
      { text: 'عوائد محتملة 15% مع مخاطر متوسطة', score: 6 },
      { text: 'عوائد محتملة 30%+ مع مخاطر عالية', score: 9 },
    ],
  },
];

const PROFILES: Record<string, Omit<InvestorProfile, 'riskScore' | 'availableCash'>> = {
  aggressive: { profileType: 'aggressive', stocksWeight: 0.50, cryptoWeight: 0.25, bondsWeight: 0.05, commoditiesWeight: 0.10, realEstateWeight: 0.05, cashWeight: 0.05 },
  balanced: { profileType: 'balanced', stocksWeight: 0.35, cryptoWeight: 0.10, bondsWeight: 0.25, commoditiesWeight: 0.10, realEstateWeight: 0.10, cashWeight: 0.10 },
  income: { profileType: 'income', stocksWeight: 0.20, cryptoWeight: 0.05, bondsWeight: 0.40, commoditiesWeight: 0.05, realEstateWeight: 0.15, cashWeight: 0.15 },
  capital_preservation: { profileType: 'capital_preservation', stocksWeight: 0.10, cryptoWeight: 0.00, bondsWeight: 0.50, commoditiesWeight: 0.05, realEstateWeight: 0.10, cashWeight: 0.25 },
};

const PROFILE_NAMES: Record<string, string> = {
  aggressive: 'نمو عنيف 🚀',
  balanced: 'متوازن ⚖️',
  income: 'دخل ثابت 💰',
  capital_preservation: 'تأمين رأس المال 🛡️',
};

export default function Questionnaire({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [cash, setCash] = useState('10000');

  const handleAnswer = (score: number) => {
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setShowResult(true);
    }
  };

  const riskScore = answers.length > 0
    ? Math.round(answers.reduce((a, b) => a + b, 0) / answers.length)
    : 5;

  const profileKey = riskScore >= 8 ? 'aggressive' : riskScore >= 5 ? 'balanced' : riskScore >= 3 ? 'income' : 'capital_preservation';
  const profile = PROFILES[profileKey];

  const handleConfirm = () => {
    const finalProfile: InvestorProfile = {
      ...profile,
      riskScore,
      availableCash: parseFloat(cash) || 0,
    };
    saveProfile(finalProfile);
    loadSampleData(); // تحميل بيانات تجريبية
    onComplete();
  };

  // شاشة النتيجة
  if (showResult) {
    const weights = [
      { label: 'أسهم', value: profile.stocksWeight },
      { label: 'عملات رقمية', value: profile.cryptoWeight },
      { label: 'سندات', value: profile.bondsWeight },
      { label: 'سلع', value: profile.commoditiesWeight },
      { label: 'عقارات', value: profile.realEstateWeight },
      { label: 'نقد', value: profile.cashWeight },
    ];

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md w-full">
          <h2 className="text-2xl font-bold text-center mb-6">نتيجة التقييم</h2>

          <div className="text-center mb-6">
            <div className="text-5xl mb-2">{riskScore >= 8 ? '🚀' : riskScore >= 5 ? '⚖️' : riskScore >= 3 ? '💰' : '🛡️'}</div>
            <div className="text-xl font-bold" style={{ color: 'var(--primary)' }}>
              {PROFILE_NAMES[profileKey]}
            </div>
            <div className="text-gray-500 mt-1">درجة المخاطر: {riskScore}/10</div>
          </div>

          <div className="mb-4">
            <div className="font-bold mb-2">التوزيع المستهدف:</div>
            {weights.map(w => (
              <div key={w.label} className="flex items-center gap-2 mb-1.5">
                <span className="w-24 text-sm">{w.label}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${w.value * 100}%`, background: 'var(--primary)' }} />
                </div>
                <span className="text-sm font-bold w-10 text-left">{(w.value * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">رأس المال المتاح ($)</label>
            <input className="input" type="number" value={cash} onChange={e => setCash(e.target.value)} />
          </div>

          <div className="flex gap-3">
            <button className="btn-outline flex-1" onClick={() => { setStep(0); setAnswers([]); setShowResult(false); }}>
              إعادة
            </button>
            <button className="btn-primary flex-1" onClick={handleConfirm}>
              تأكيد والمتابعة
            </button>
          </div>
        </div>
      </div>
    );
  }

  // الأسئلة
  const question = QUESTIONS[step];
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-md w-full">
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>السؤال {step + 1} من {QUESTIONS.length}</span>
            <span>{Math.round(((step + 1) / QUESTIONS.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${((step + 1) / QUESTIONS.length) * 100}%`, background: 'var(--primary)' }} />
          </div>
        </div>

        <h2 className="text-xl font-bold mb-6 text-center">{question.q}</h2>

        <div className="flex flex-col gap-3">
          {question.opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(opt.score)}
              className="p-4 border-2 border-gray-200 rounded-xl text-right hover:border-primary-light hover:bg-primary-bg transition-all cursor-pointer"
            >
              {opt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
