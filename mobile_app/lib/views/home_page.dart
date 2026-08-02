import 'dart:async';
import 'package:flutter/material.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_app/views/log_page.dart';

// 各コンポーネント・サービスのインポート
import '../services/tts_service.dart';
import '../widgets/device_status_card.dart';
import '../widgets/radar_display.dart';
import '../widgets/emergency_button.dart';
import '../services/motion_tracker_service.dart';
import '../services/auth_service.dart';
import 'login_page.dart'; // ログアウト後に戻るためのインポート

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  String _batteryLevel = "読み込み中...";
  String _gpsStatus = "OFF";
  String _syncStatus = "停止中";

  String _radarMessage = "前方 2.5m 内に障害物なし";
  bool _hasObstacle = false;

  final Battery _battery = Battery();
  final TtsService _ttsService = TtsService();

  MotionAutoTracker? _autoTracker;

  StreamSubscription<ServiceStatus>? _gpsServiceStatusSubscription;
  Timer? _batteryTimer;

  @override
  void initState() {
    super.initState();

    final patientId = AuthService().getpatientId();

    if (patientId == null) {
      debugPrint("patientIdが取得できませんでした（未ログイン状態です）");
      return; // ログインしていなければ追跡を開始しない
    }

    _ttsService.init();
    _initDeviceStates();
    _autoTracker = MotionAutoTracker(patientId: patientId);
    _autoTracker!.start();
  }

  void _initDeviceStates() async {
    _updateBatteryLevel();
    _batteryTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _updateBatteryLevel();
    });

    bool isGpsEnabled = await Geolocator.isLocationServiceEnabled();
    setState(() {
      _gpsStatus = isGpsEnabled ? "ON" : "OFF";
      _syncStatus = isGpsEnabled ? "同期中" : "停止中";
    });

    _gpsServiceStatusSubscription =
        Geolocator.getServiceStatusStream().listen((ServiceStatus status) {
      setState(() {
        if (status == ServiceStatus.enabled) {
          _gpsStatus = "ON";
          _syncStatus = "同期中";
        } else {
          _gpsStatus = "OFF";
          _syncStatus = "停止中";
        }
      });
    });
  }

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

  void _handleObstacleDetected(String type, double distance) async {
    String message = "";
    if (type == "stairs") {
      message = "${distance.toInt()}メートル先に階段があります。";
    } else if (type == "railway") {
      message = "${distance.toInt()}メートル先に線路があります。注意してください。";
    } else {
      message = "前方、$distanceメートルに障害物があります。";
    }

    setState(() {
      _radarMessage = message;
      _hasObstacle = true;
    });

    await _ttsService.speakObstacle(type, distance);
  }

  void _clearObstacleStatus() {
    setState(() {
      _radarMessage = "前方 2.5m 内に障害物なし";
      _hasObstacle = false;
    });
  }

  // ★ 誤操作を防ぐ文字入力付きログアウト確認ダイアログ
  void _showLogoutConfirmation(BuildContext context) {
    final TextEditingController confirmController = TextEditingController();
    bool isInputValid = false;

    showDialog(
      context: context,
      barrierDismissible: false, // ダイアログの外をタップしても閉じないようにする
      builder: (context) {
        return StatefulBuilder(
          // ダイアログ内の文字入力をリアルタイムに検知してボタン状態を変える
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: Colors.white, // 全体に合わせてダーク系に
              title: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Colors.orange),
                  SizedBox(width: 8),
                  Text('ログアウトの確認', style: TextStyle(color: Colors.black87)),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '安全のため、確認として下に「ログアウト」と入力してください。',
                    style: TextStyle(color: Colors.black54),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: confirmController,
                    style: const TextStyle(color: Colors.black87),
                    autofocus: true,
                    decoration: InputDecoration(
                      hintText: 'ログアウト',
                      hintStyle: const TextStyle(color: Colors.black38),
                      enabledBorder: const UnderlineInputBorder(
                          borderSide: BorderSide(color: Colors.black26)),
                      focusedBorder: const UnderlineInputBorder(
                          borderSide: BorderSide(color: Colors.green)),
                    ),
                    onChanged: (text) {
                      // 入力された文字が「ログアウト」と完全一致しているか判定
                      setDialogState(() {
                        isInputValid = (text.trim() == 'ログアウト');
                      });
                    },
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('キャンセル',
                      style: TextStyle(color: Colors.black54)),
                ),
                ElevatedButton(
                  // 文字が正しく入力されているときだけ関数を有効化（それ以外はボタンが無効＝灰色になる）
                  onPressed: isInputValid
                      ? () {
                          Navigator.pop(context); // ダイアログを閉じる
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const LoginPage()), // ログイン画面へ戻る
                          );
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red[700],
                    disabledBackgroundColor: Colors.black12, // 無効化されているときのボタンの色
                    disabledForegroundColor: Colors.black38, // 無効化されているときの文字の色
                  ),
                  child: const Text('確定',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  void dispose() {
    _batteryTimer?.cancel();
    _gpsServiceStatusSubscription?.cancel();
    _ttsService.stop();
    _autoTracker?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('デバイス制御パネル'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        actions: [
          // ログアウトボタン押下時に確認アラートを呼ぶように変更
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _showLogoutConfirmation(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildSectionTitle('デバイス状態'),
            DeviceStatusCard(
              batteryLevel: _batteryLevel,
              gpsStatus: _gpsStatus,
              syncStatus: _syncStatus,
            ),
            const SizedBox(height: 24),
            _buildSectionTitle('障害物検知システム'),
            RadarDisplay(
              radarMessage: _radarMessage,
              hasObstacle: _hasObstacle,
              onClear: _clearObstacleStatus,
              onTestPressed: _handleObstacleDetected,
            ),
            const SizedBox(height: 24),
            _buildSectionTitle('緊急アクション'),
            const EmergencyButton(),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.map),
                label: const Text("移動ログ"),
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const LogPage(),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Text(title,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
    );
  }
}
