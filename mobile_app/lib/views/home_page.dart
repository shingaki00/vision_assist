import 'package:flutter/material.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('デバイス制御パネル'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          IconButton(icon: const Icon(Icons.logout), onPressed: () => Navigator.pop(context)),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. デバイス連携機能（状態表示）
            _buildSectionTitle('デバイス状態'),
            Card(
              elevation: 4,
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatusItem(Icons.battery_charging_full, '85%', 'バッテリー', Colors.green),
                    _buildStatusItem(Icons.bluetooth_connected, '接続済み', 'デバイス連携', Colors.blue),
                    _buildStatusItem(Icons.sync, '同期中', '移動ログ', Colors.orange),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // 2. 障害物検知（リアルタイム表示イメージ）
            _buildSectionTitle('障害物検知システム'),
            Container(
              height: 120,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.radar, color: Colors.greenAccent, size: 40),
                  SizedBox(height: 8),
                  Text('前方 2.5m 内に障害物なし', style: TextStyle(color: Colors.greenAccent)),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // 3. 緊急連絡機能（管理者に送信）
            _buildSectionTitle('緊急アクション'),
            SizedBox(
              width: double.infinity,
              height: 80,
              child: ElevatedButton.icon(
                onPressed: () => _showEmergencyDialog(context),
                icon: const Icon(Icons.warning_amber_rounded, size: 32),
                label: const Text('管理者に緊急連絡を送信', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // セクションタイトル用
  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
    );
  }

  // 状態表示アイコン用
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

  // 緊急連絡ダイアログ
  void _showEmergencyDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('緊急連絡の送信'),
        content: const Text('管理者に現在の位置情報とアラートを送信しますか？'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('キャンセル')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('管理者にメッセージを送信しました'), backgroundColor: Colors.red),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('送信'),
          ),
        ],
      ),
    );
  }
}