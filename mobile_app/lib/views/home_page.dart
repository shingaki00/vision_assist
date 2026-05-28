import 'dart:async';
import 'package:flutter/material.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  // 状態管理用の変数
  String _batteryLevel = "読み込み中...";
  String _gpsStatus = "OFF";
  String _syncStatus = "停止中";

  // バッテリーとGPS監視用のインスタンス・サブスクリプション
  final Battery _battery = Battery();
  StreamSubscription<ServiceStatus>? _gpsServiceStatusSubscription;
  Timer? _batteryTimer;

  @override
  void initState() {
    super.initState();
    _initDeviceStates();
  }

  // デバイス状態の初期化・監視開始
  void _initDeviceStates() async {
    // 1. バッテリーの初期値取得と定期監視（10秒ごと）
    _updateBatteryLevel();
    _batteryTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _updateBatteryLevel();
    });

    // 2. GPSの初期状態取得
    bool isGpsEnabled = await Geolocator.isLocationServiceEnabled();
    setState(() {
      _gpsStatus = isGpsEnabled ? "ON" : "OFF";
      _syncStatus = isGpsEnabled ? "同期中" : "停止中";
    });

    // 3. GPSのON/OFF状態の変化をリアルタイムに監視
    _gpsServiceStatusSubscription = Geolocator.getServiceStatusStream().listen((ServiceStatus status) {
      setState(() {
        if (status == ServiceStatus.enabled) {
          _gpsStatus = "ON";
          _syncStatus = "同期中"; // GPSがONになったらログ同期を開始
        } else {
          _gpsStatus = "OFF";
          _syncStatus = "停止中";
        }
      });
    });
  }

  // バッテリー残量を更新する関数
  void _updateBatteryLevel() async {
    try {
      final level = await _battery.batteryLevel;
      if (mounted) {
        setState(() {
          _batteryLevel = "$level%";
        });
      }
    } catch (e) {
      _batteryLevel = "エラー";
    }
  }

  @override
  void dispose() {
    // 画面が閉じられたら監視を解除してメモリリークを防ぐ
    _batteryTimer?.cancel();
    _gpsServiceStatusSubscription?.cancel();
    super.dispose();
  }

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
                    // バッテリー状態の連動
                    _buildStatusItem(
                      Icons.battery_charging_full, 
                      _batteryLevel, 
                      'スマホバッテリー', 
                      _batteryLevel.contains('100') || _batteryLevel.startsWith('9') || _batteryLevel.startsWith('8') ? Colors.green : Colors.orange
                    ),
                    // GPS状態の連動（ON/OFFで色を変える）
                    _buildStatusItem(
                      Icons.location_on, 
                      _gpsStatus, 
                      'GPS連携', 
                      _gpsStatus == "ON" ? Colors.blue : Colors.grey
                    ),
                    // 移動ログ状態の連動
                    _buildStatusItem(
                      Icons.sync, 
                      _syncStatus, 
                      '移動ログ', 
                      _syncStatus == "同期中" ? Colors.orange : Colors.grey
                    ),
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