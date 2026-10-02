import 'package:flutter/material.dart';

class RadarDisplay extends StatelessWidget {
  final String radarMessage;
  final bool hasObstacle;
  final VoidCallback onClear;

  const RadarDisplay({
    super.key,
    required this.radarMessage,
    required this.hasObstacle,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: hasObstacle ? Colors.red[700] : Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 8.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.radar, 
              color: hasObstacle ? Colors.white : Colors.green[700], 
              size: 40
            ),
            const SizedBox(height: 8),
            Text(
              radarMessage, 
              style: TextStyle(
                color: hasObstacle ? Colors.white : Colors.green[800],
                fontWeight: FontWeight.bold
              ),
              textAlign: TextAlign.center,
            ),
            
            if (hasObstacle) ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: onClear,
                icon: const Icon(Icons.refresh, color: Colors.white, size: 16),
                label: const Text('安全状態に戻す', style: TextStyle(color: Colors.white)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}