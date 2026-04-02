import 'package:flutter/material.dart';
import 'dart:math';

/// مؤشر Optimum Score دائري
class OSGauge extends StatelessWidget {
  final double value; // 0.0 - 1.0
  final double size;
  final String? label;

  const OSGauge({
    super.key,
    required this.value,
    this.size = 80,
    this.label,
  });

  Color get _color {
    if (value >= 0.7) return Colors.green;
    if (value <= 0.3) return Colors.red;
    return Colors.orange;
  }

  String get _signalText {
    if (value >= 0.7) return 'شراء';
    if (value <= 0.3) return 'بيع';
    return 'انتظار';
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _GaugePainter(value: value, color: _color),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                (value * 100).toStringAsFixed(0),
                style: TextStyle(
                  fontSize: size * 0.22,
                  fontWeight: FontWeight.bold,
                  color: _color,
                ),
              ),
              Text(
                label ?? _signalText,
                style: TextStyle(
                  fontSize: size * 0.12,
                  color: _color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  final double value;
  final Color color;

  _GaugePainter({required this.value, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 6;

    // الخلفية
    final bgPaint = Paint()
      ..color = Colors.grey[200]!
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -pi * 0.75,
      pi * 1.5,
      false,
      bgPaint,
    );

    // القيمة
    final fgPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 8
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -pi * 0.75,
      pi * 1.5 * value,
      false,
      fgPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _GaugePainter oldDelegate) =>
      oldDelegate.value != value || oldDelegate.color != color;
}
