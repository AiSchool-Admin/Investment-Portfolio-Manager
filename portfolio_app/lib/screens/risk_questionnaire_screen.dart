import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/investor_profile.dart';
import '../providers/portfolio_provider.dart';
import 'home_screen.dart';

/// شاشة استبيان المخاطر - 7 أسئلة لتحديد الملف الاستثماري
class RiskQuestionnaireScreen extends ConsumerStatefulWidget {
  const RiskQuestionnaireScreen({super.key});

  @override
  ConsumerState<RiskQuestionnaireScreen> createState() =>
      _RiskQuestionnaireScreenState();
}

class _RiskQuestionnaireScreenState
    extends ConsumerState<RiskQuestionnaireScreen> {
  int _currentQuestion = 0;
  final _answers = <int>[];
  final _cashController = TextEditingController();

  static const _questions = [
    {
      'question': 'ما هو هدفك الاستثماري الأساسي؟',
      'options': [
        {'text': 'الحفاظ على رأس المال', 'score': 1},
        {'text': 'تحقيق دخل ثابت', 'score': 3},
        {'text': 'نمو متوازن', 'score': 6},
        {'text': 'نمو عنيف وتعظيم العوائد', 'score': 9},
      ],
    },
    {
      'question': 'ما هو أفقك الزمني للاستثمار؟',
      'options': [
        {'text': 'أقل من سنة', 'score': 1},
        {'text': '1-3 سنوات', 'score': 3},
        {'text': '3-7 سنوات', 'score': 6},
        {'text': 'أكثر من 7 سنوات', 'score': 9},
      ],
    },
    {
      'question': 'كيف تتصرف إذا انخفضت محفظتك 20%؟',
      'options': [
        {'text': 'أبيع كل شيء فوراً', 'score': 1},
        {'text': 'أبيع جزءاً لتقليل الخسائر', 'score': 3},
        {'text': 'أنتظر التعافي', 'score': 6},
        {'text': 'أشتري المزيد (فرصة)', 'score': 9},
      ],
    },
    {
      'question': 'ما نسبة دخلك التي يمكنك تحمل خسارتها؟',
      'options': [
        {'text': 'لا أتحمل أي خسارة', 'score': 1},
        {'text': 'حتى 5%', 'score': 3},
        {'text': 'حتى 15%', 'score': 6},
        {'text': 'أكثر من 15%', 'score': 9},
      ],
    },
    {
      'question': 'ما خبرتك في الاستثمار؟',
      'options': [
        {'text': 'مبتدئ تماماً', 'score': 1},
        {'text': 'خبرة محدودة (1-2 سنة)', 'score': 3},
        {'text': 'خبرة متوسطة (3-5 سنوات)', 'score': 6},
        {'text': 'خبرة واسعة (أكثر من 5 سنوات)', 'score': 9},
      ],
    },
    {
      'question': 'ما رأيك في العملات الرقمية؟',
      'options': [
        {'text': 'مخاطرة عالية لا أريدها', 'score': 1},
        {'text': 'نسبة صغيرة جداً للتنويع', 'score': 3},
        {'text': 'جزء معقول من المحفظة', 'score': 6},
        {'text': 'فرصة كبيرة للنمو', 'score': 9},
      ],
    },
    {
      'question': 'أيهما تفضل؟',
      'options': [
        {'text': 'عوائد مضمونة 3% سنوياً', 'score': 1},
        {'text': 'عوائد محتملة 8% مع مخاطر قليلة', 'score': 3},
        {'text': 'عوائد محتملة 15% مع مخاطر متوسطة', 'score': 6},
        {'text': 'عوائد محتملة 30%+ مع مخاطر عالية', 'score': 9},
      ],
    },
  ];

  void _selectAnswer(int score) {
    _answers.add(score);
    if (_currentQuestion < _questions.length - 1) {
      setState(() => _currentQuestion++);
    } else {
      _showResults();
    }
  }

  void _showResults() {
    final avgScore =
        _answers.reduce((a, b) => a + b) / _answers.length;
    final riskScore = avgScore.round().clamp(1, 10);

    InvestorProfile profile;
    if (riskScore >= 8) {
      profile = InvestorProfile.aggressive();
    } else if (riskScore >= 5) {
      profile = InvestorProfile.balanced();
    } else if (riskScore >= 3) {
      profile = InvestorProfile.income();
    } else {
      profile = InvestorProfile.capitalPreservation();
    }
    profile = profile.copyWith(riskScore: riskScore);

    _showProfileDialog(profile);
  }

  void _showProfileDialog(InvestorProfile profile) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('نتيجة التقييم'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildResultRow('درجة المخاطر', '${profile.riskScore}/10'),
              _buildResultRow('النمط المقترح', profile.profileTypeArabic),
              const Divider(),
              const Text('التوزيع المستهدف:',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              _buildWeightRow('أسهم', profile.stocksWeight),
              _buildWeightRow('عملات رقمية', profile.cryptoWeight),
              _buildWeightRow('سندات', profile.bondsWeight),
              _buildWeightRow('سلع', profile.commoditiesWeight),
              _buildWeightRow('عقارات', profile.realEstateWeight),
              _buildWeightRow('نقد', profile.cashWeight),
              const Divider(),
              TextField(
                controller: _cashController,
                decoration: const InputDecoration(
                  labelText: 'رأس المال المتاح (\$)',
                  hintText: 'مثال: 10000',
                ),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _currentQuestion = 0;
                _answers.clear();
              });
            },
            child: const Text('إعادة الاستبيان'),
          ),
          FilledButton(
            onPressed: () async {
              final cash =
                  double.tryParse(_cashController.text) ?? 0.0;
              final finalProfile =
                  profile.copyWith(availableCash: cash);
              await ref
                  .read(profileProvider.notifier)
                  .saveProfile(finalProfile);
              if (!mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const HomeScreen()),
                (route) => false,
              );
            },
            child: const Text('تأكيد والمتابعة'),
          ),
        ],
      ),
    );
  }

  Widget _buildResultRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
          Text(value,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _buildWeightRow(String label, double weight) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text('${(weight * 100).toStringAsFixed(0)}%',
              style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          Expanded(
            child: LinearProgressIndicator(
              value: weight,
              backgroundColor: Colors.grey[300],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final question = _questions[_currentQuestion];
    final options = question['options'] as List<Map<String, dynamic>>;
    final progress = (_currentQuestion + 1) / _questions.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('تحديد الملف الاستثماري'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // شريط التقدم
              LinearProgressIndicator(
                value: progress,
                minHeight: 8,
                borderRadius: BorderRadius.circular(4),
              ),
              const SizedBox(height: 8),
              Text(
                'السؤال ${_currentQuestion + 1} من ${_questions.length}',
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              // السؤال
              Text(
                question['question'] as String,
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              // الخيارات
              ...options.map((option) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: OutlinedButton(
                      onPressed: () =>
                          _selectAnswer(option['score'] as int),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.all(16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: Text(
                        option['text'] as String,
                        style: const TextStyle(fontSize: 16),
                      ),
                    ),
                  )),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _cashController.dispose();
    super.dispose();
  }
}
