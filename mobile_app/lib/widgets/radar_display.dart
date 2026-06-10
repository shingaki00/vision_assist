import 'package:flutter/material.dart';

class RadarDisplay extends StatelessWidget {
  final String radarMessage;
  final bool hasObstacle;
  final VoidCallback onClear;
  final Function(String type, double distance) onTestPressed;

  const RadarDisplay({
    super.key,
    required this.radarMessage,
    required this.hasObstacle,
    required this.onClear,
    required this.onTestPressed,
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

            Divider(color: hasObstacle ? Colors.white24 : Colors.black12, height: 24),
            
            Text(
              '音声テスト用ボタン (他班へのデモにも使えます)',
              style: TextStyle(color: hasObstacle ? Colors.white70 : Colors.black54, fontSize: 11),
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildTestButton('階段(5m)', () => onTestPressed("stairs", 5.0)),
                _buildTestButton('線路(5m)', () => onTestPressed("railway", 5.0)),
                _buildTestButton('一般障害物', () => onTestPressed("normal", 2.0)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTestButton(String label, VoidCallback onPressed) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.green[700], 
        foregroundColor: Colors.white
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}