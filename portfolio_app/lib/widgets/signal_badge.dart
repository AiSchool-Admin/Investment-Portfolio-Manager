import 'package:flutter/material.dart';

/// شارة الإشارة (شراء/بيع/انتظار)
class SignalBadge extends StatelessWidget {
  final String signalType; // buy, sell, none

  const SignalBadge({super.key, required this.signalType});

  @override
  Widget build(BuildContext context) {
    final Color color;
    final String text;
    final IconData icon;

    switch (signalType) {
      case 'buy':
        color = Colors.green;
        text = 'شراء';
        icon = Icons.arrow_downward;
        break;
      case 'sell':
        color = Colors.red;
        text = 'بيع';
        icon = Icons.arrow_upward;
        break;
      default:
        color = Colors.grey;
        text = 'انتظار';
        icon = Icons.pause;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            text,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
