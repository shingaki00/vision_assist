// 歩行ログの作成・位置情報送信を行う
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:geolocator/geolocator.dart';
import 'package:flutter/foundation.dart';

class WalkingTrackerService {
  // ★実機テスト時は "localhost" ではなくPCのローカルIPを指定
  // 何も指定しなければAndroidエミュレータ用がデフォルト
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://10.0.2.2:3000',
  );

  int? _currentLogId;
  StreamSubscription<Position>? _positionSub;

  bool get isTracking => _currentLogId != null;

  Timer? _heartbeatTimer;
  Timer? _stationaryCheckTimer;
  DateTime? _lastMovementTime;

  // 一定時間動きがなければ自動終了とみなす
  static const Duration stationaryTimeout = Duration(minutes: 3);
  static const Duration stationaryCheckInterval = Duration(seconds: 30);

  // 終了時に呼ばれるコールバック（自動/手動を区別）
  void Function(String reason)? onStopped;

  /// 歩行開始：walkingLogsを作成してlog_idを取得し、位置情報の送信を開始する
  Future<int> startTracking(String patientId) async {
    debugPrint("startTracking開始");
    await _ensurePermission();
    debugPrint("権限OK");

    // walkingLogsに end_time: null で新規作成
    final res = await http.post(
      Uri.parse("$apiBase/walkingLogs"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "patient_id": patientId,
        "start_time": DateTime.now().toIso8601String(),
        "end_time": null,
      }),
    );

    if (res.statusCode != 201) {
      throw Exception("歩行ログの作成に失敗しました: ${res.statusCode}");
    }

    final log = jsonDecode(res.body);
    _currentLogId = log["id"];
    _lastMovementTime = DateTime.now();

    _startSendingPosition(_currentLogId!);
    _startStationaryWatcher();
    return _currentLogId!;
  }

  /// 歩行終了：end_timeを更新し、位置情報の送信を停止する
  Future<void> stopTracking({String reason = "auto"}) async {
    if (_currentLogId == null) return;

    await http.patch(
      Uri.parse("$apiBase/walkingLogs/$_currentLogId"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "end_time": DateTime.now().toIso8601String(),
      }),
    );

    await _positionSub?.cancel();
    _positionSub = null;
    _currentLogId = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _stationaryCheckTimer?.cancel();
    _stationaryCheckTimer = null;
    _lastMovementTime = null;

    onStopped?.call(reason);
  }

  // ── 内部処理 ──────────────────────────

  Future<void> _ensurePermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    debugPrint("現在の権限: $permission");
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception("位置情報の権限が拒否されました");
      }
    }
    if (permission == LocationPermission.deniedForever) {
      throw Exception("位置情報の権限が拒否されています。設定から許可してください");
    }

    if (!await Geolocator.isLocationServiceEnabled()) {
      throw Exception("端末の位置情報サービスがオフになっています");
    }
  }

  void _startSendingPosition(int logId) {
    debugPrint("_startSendingPosition開始");

    // 5m移動したら送信（間隔よりも移動量ベース）
    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 5,
    );

    _positionSub =
        Geolocator.getPositionStream(locationSettings: settings).listen((pos) {

      debugPrint("位置更新");
      debugPrint("${pos.latitude}, ${pos.longitude}");
    
      _lastMovementTime = DateTime.now();
      _sendPoint(logId, pos);
    });

    // 時間ベースのハートビート（停止時のフォールバック）
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 180), (_) async {
      try {
        final pos = await Geolocator.getCurrentPosition(
          locationSettings: settings,
        );
        await _sendPoint(logId, pos);
      } catch (e) {
        debugPrint("ハートビート送信失敗: $e");
      }
    });
  }

  // 一定時間動きがなければ自動終了
  void _startStationaryWatcher() {
    _stationaryCheckTimer = Timer.periodic(stationaryCheckInterval, (_) {
      if (_lastMovementTime == null) return;
      final idle = DateTime.now().difference(_lastMovementTime!);
      if (idle >= stationaryTimeout) {
        stopTracking(reason: "auto");
      }
    });
  }

  Future<void> _sendPoint(int logId, Position pos) async {
    debugPrint("送信開始");
    debugPrint("logId=$logId");
    debugPrint("${pos.latitude}, ${pos.longitude}");
    try {
      final response = await http.post(
        Uri.parse("$apiBase/gpsData"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "log_id": logId,
          "latitude": pos.latitude,
          "longitude": pos.longitude,
          "timestamp": DateTime.now().toIso8601String(),
        }),
      );
      debugPrint("gpsData status=${response.statusCode}");
      debugPrint("gpsData body=${response.body}");
    } catch (e) {
      // 通信失敗時はログのみ（次回のGPS更新で再送されるため致命的ではない）
      debugPrint("GPS送信失敗: $e");
    }
  }
}
