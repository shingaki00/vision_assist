import 'package:flutter/material.dart';

class DeviceStatusCard extends StatelessWidget {
  final String batteryLevel;
  final String gpsStatus;
  final String syncStatus;

  const DeviceStatusCard({
    super.key,
    required this.batteryLevel,
    required this.gpsStatus,
    required this.syncStatus,
  });

  @override
  Widget build(BuildContext context) {
    // バッテリー残量に応じた色判定
    Color getBatteryColor() {
      if (batteryLevel.contains('100') || 
          batteryLevel.startsWith('9') || 
          batteryLevel.startsWith('8')) {
        return Colors.green;
      }
      return Colors.orange;
    }

    return Card(
      elevation: 4,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatusItem(
              Icons.battery_charging_full, 
              batteryLevel, 
              'スマホバッテリー', 
              getBatteryColor()
            ),
            _buildStatusItem(
              Icons.location_on, 
              gpsStatus, 
              'GPS連携', 
              gpsStatus == "ON" ? Colors.blue : Colors.grey
            ),
            _buildStatusItem(
              Icons.sync, 
              syncStatus, 
              '移動ログ', 
              syncStatus == "同期中" ? Colors.orange : Colors.grey
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusItem(IconData icon, String value, String label, Color color) {
    return Column(
      children: [
        Icon(icon, color: color, size: 30),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}