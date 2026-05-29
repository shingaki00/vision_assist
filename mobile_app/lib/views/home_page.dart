import 'dart:async';
import 'package:flutter/material.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_tts/flutter_tts.dart'; // ← 1. TTSパッケージのインポートを追加

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

  // 障害物検知システム用の変数 (動的に変更できるように拡張)
  String _radarMessage = "前方 2.5m 内に障害物なし";
  bool _hasObstacle = false;

  // バッテリー、GPS、および音声読み上げ用のインスタンス・サブスクリプション
  final Battery _battery = Battery();
  final FlutterTts _flutterTts = FlutterTts(); // ← 2. TTSインスタンスを追加
  StreamSubscription<ServiceStatus>? _gpsServiceStatusSubscription;
  Timer? _batteryTimer;

  @override
  void initState() {
    super.initState();
    _initDeviceStates();
    _initTtsSettings(); // ← 3. 音声読み上げの初期設定を呼び出し
  }

  // 音声読み上げ（Text-To-Speech）の初期設定
  void _initTtsSettings() async {
    await _flutterTts.setLanguage("ja-JP"); // 言語を日本語に設定
    await _flutterTts.setSpeechRate(1.5);   // 読み上げ速度 (0.0 〜 1.5)
    await _flutterTts.setVolume(1.0);       // 音量 (0.0 〜 1.0)
    await _flutterTts.setPitch(1.0);        // 声の高さ (0.5 〜 2.0)
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

  // ★ 障害物を検知した時、またはテストボタンが押された時に音声を鳴らす関数
  void _onObstacleDetected(String type, double distance) async {
    String message = "";
    
    // 検知した対象物に応じて適切な日本語アナウンスを生成
    if (type == "stairs") {
      message = "${distance.toInt()}メートル先に階段があります。";
    } else if (type == "railway") {
      message = "${distance.toInt()}メートル先に線路があります。注意してください。";
    } else {
      message = "前方、${distance}メートルに障害物があります。";
    }

    // 1. UI（画面表示と色）を危険状態に更新
    setState(() {
      _radarMessage = message;
      _hasObstacle = true;
    });

    // 2. 音声を再生（イヤホンやスマホのスピーカーから出力されます）
    await _flutterTts.speak(message);
  }

  // ★ 障害物がない安全な状態（通常状態）に戻す関数
  void _clearObstacleStatus() {
    setState(() {
      _radarMessage = "前方 2.5m 内に障害物なし";
      _hasObstacle = false;
    });
  }

  @override
  void dispose() {
    // 画面が閉じられたら監視を解除してメモリリークを防ぐ
    _batteryTimer?.cancel();
    _gpsServiceStatusSubscription?.cancel();
    _flutterTts.stop(); // 画面遷移時に音声再生を安全に停止
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

            // 2. 障害物検知（リアルタイム表示 ＆ 音声連動）
            _buildSectionTitle('障害物検知システム'),
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                // 障害物検知時は背景を警告色のダークレッドに、通常時は黒に変更
                color: _hasObstacle ? Colors.red[900] : Colors.black87,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16.0, horizontal: 8.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.radar, 
                      color: _hasObstacle ? Colors.white : Colors.greenAccent, 
                      size: 40
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _radarMessage, 
                      style: TextStyle(
                        color: _hasObstacle ? Colors.white : Colors.greenAccent,
                        fontWeight: FontWeight.bold
                      ),
                      textAlign: TextAlign.center,
                    ),
                    
                    // 障害物検知時のクリアボタンを表示
                    if (_hasObstacle) ...[
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: _clearObstacleStatus,
                        icon: const Icon(Icons.refresh, color: Colors.white70, size: 16),
                        label: const Text('安全状態に戻す', style: TextStyle(color: Colors.white70)),
                      ),
                    ],

                    const Divider(color: Colors.white24, height: 24),
                    
                    // 【開発・デバッグ用】実際に音声アシストを試せるテストボタン群
                    const Text('音声テスト用ボタン (他班へのデモにも使えます)', style: TextStyle(color: Colors.white60, fontSize: 11)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        ElevatedButton(
                          onPressed: () => _onObstacleDetected("stairs", 5.0),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white),
                          child: const Text('階段(5m)', style: TextStyle(fontSize: 12)),
                        ),
                        ElevatedButton(
                          onPressed: () => _onObstacleDetected("railway", 5.0),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white),
                          child: const Text('線路(5m)', style: TextStyle(fontSize: 12)),
                        ),
                        ElevatedButton(
                          onPressed: () => _onObstacleDetected("normal", 2.0),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white),
                          child: const Text('一般障害物', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ],
                ),
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