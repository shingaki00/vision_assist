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
  Position? _lastPosition;

  bool get isTracking => _currentLogId != null;

  Timer? _heartbeatTimer;
  Timer? _stationaryCheckTimer;
  DateTime? _lastMovementTime;
  DateTime? _sessionStartTime;

  // 一定時間動きがなければ自動終了とみなす
  static const Duration stationaryTimeout = Duration(minutes: 3);
  static const Duration stationaryCheckInterval = Duration(seconds: 30);

  // 終了時に呼ばれるコールバック（自動/手動を区別）
  void Function(String reason)? onStopped;

  /// 歩行開始：walkingLogsを作成してlog_idを取得し、位置情報の送信を開始する
  Future<int> startTracking(String patientId) async {
    debugPrint("startTracking開始");
    await _positionSub?.cancel();
    _positionSub = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _stationaryCheckTimer?.cancel();
    _stationaryCheckTimer = null;
    _currentLogId = null;

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
    _sessionStartTime = DateTime.now();

    _startSendingPosition(_currentLogId!);
    _startStationaryWatcher();
    _lastPosition = null;
    return _currentLogId!;
  }

  /// 歩行終了：end_timeを更新し、位置情報の送信を停止する
  Future<void> stopTracking({String reason = "auto"}) async {
    if (_currentLogId == null) return;
    final targetLogId = _currentLogId;

    await _positionSub?.cancel();
    _positionSub = null;
    _currentLogId = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _stationaryCheckTimer?.cancel();
    _stationaryCheckTimer = null;
    _lastMovementTime = null;
    _sessionStartTime = null;

    try {
      if (reason == "auto") {
        final checkRes =
          await http.get(Uri.parse("$apiBase/gpsData?log_id=$targetLogId"));
        if (checkRes.statusCode == 200) {
          final List gpsList = jsonDecode(checkRes.body);

          // GPSが2件以下、または移動がない場合は空ログとみなして削除
          if (gpsList.length <= 2) {
            debugPrint("移動がなかったため空ログ (log_id: $targetLogId) を削除します");
            await http.delete(Uri.parse("$apiBase/walkingLogs/$targetLogId"));
            onStopped?.call(reason);
            return; // 終了処理を行わず終了
          }
        }
      }
      final patchRes = await http.patch(
        Uri.parse("$apiBase/walkingLogs/$targetLogId"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({
          "end_time": DateTime.now().toIso8601String(),
        }),
      );

      debugPrint("walkingLogs PATCH status=${patchRes.statusCode}");
      debugPrint("walkingLogs PATCH response=${patchRes.body}");

      if (patchRes.statusCode != 200 && patchRes.statusCode != 204) {
        debugPrint("【エラー】end_timeの更新に失敗しました: status=${patchRes.statusCode}");
      }
    } catch (e) {
      debugPrint("walkingLogsの終了更新に失敗しました: $e");
    }
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
  // ---【追加】あまりにも遠くへジャンプ（ワープ）したら別ログとして分割 ---
    if (_lastPosition != null) {
      double distanceInMeters = Geolocator.distanceBetween(
        _lastPosition!.latitude,
        _lastPosition!.longitude,
        pos.latitude,
        pos.longitude,
      );

      // 一回の更新（数秒）で500m以上移動していたらワープとみなす
      if (distanceInMeters > 500) {
        debugPrint("大きな移動を検知（${distanceInMeters}m）。現在のログを終了して新規開始します。");

        // 現在のログを終了
        await stopTracking(reason: "teleport_detected");

        // ※必要に応じてここで自動的に startTracking(patientId) を再呼出しする
        return;
      }
    }
    _lastPosition = pos;

    // キャッシュチェック
    if (_sessionStartTime != null) {
      // UTC/Localの差分による誤判定を防ぐため toUtc() で統一して比較する
      // また、端末GPSの僅かな遅延を考慮して 5秒程度のバッファを持たせる
      final posUtc = pos.timestamp.toUtc();
      final sessionStartUtc =
          _sessionStartTime!.toUtc().subtract(const Duration(seconds: 5));

      if (posUtc.isBefore(sessionStartUtc)) {
        debugPrint(
            "古いキャッシュGPSデータをスキップしました (pos: $posUtc, start: $sessionStartUtc)");
        return;
      }
    }

    // 2. 精度誤差が大きすぎる場合（例: 100m以上ズレている）は除外
    if (pos.accuracy > 100) {
      debugPrint("精度の低いGPSデータをスキップしました (accuracy: ${pos.accuracy})");
      return;
    }

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
      debugPrint("GPS送信失敗: $e");
    }
  }
}
