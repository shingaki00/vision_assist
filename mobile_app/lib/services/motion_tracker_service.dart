// 歩き出し検知→記録開始→自動終了→また歩き出し検知に戻るサイクル全体を管理する
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'walking_tracker_service.dart';

/// 歩き出しを自動検知して記録を開始し、止まったら自動終了する。
/// 画面側はこのクラスを1つ持つだけでよい。
class MotionAutoTracker {
  static const int movementStartDistanceM = 5; // これ以上動いたら「歩き出した」とみなす
  static const LocationAccuracy idleAccuracy = LocationAccuracy.high;

  final WalkingTrackerService _tracker;
  final String patientId;

  StreamSubscription<Position>? _idleSub;
  bool _isWatchingIdle = false;

  // クールタイム判定用の停止時刻保持変数
  DateTime? _lastStoppedTime;

  void Function(int logId)? onTrackingStarted;
  void Function(String reason)? onTrackingStopped;
  static bool testMode = true; // 実機で歩いて試す時はfalse（5mごと）
  void Function(Position)? onPosition;

  MotionAutoTracker({required this.patientId})
      : _tracker = WalkingTrackerService() {
    _tracker.onStopped = (reason) {
      _lastStoppedTime = DateTime.now();
      _tracker.onPosition = (p) => onPosition?.call(p);
      onTrackingStopped?.call(reason);
      _startIdleWatch(); // 終了したら再び「歩き出し」の監視に戻る
    };
  }
  bool get isTracking => _tracker.isTracking;

  // 監視を開始する。画面が開いたタイミングで1回呼ぶ想定。
  Future<void> start() async {
    debugPrint("startTracking 呼ばれた");
    await _ensureIdlePermission();
    debugPrint("permission OK");
    await _startIdleWatch();
    debugPrint("watch started");
  }

  // 権限を確認する
  Future<void> _ensureIdlePermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      debugPrint("MotionAutoTracker: 位置情報の権限がありません");
      return;
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      debugPrint("MotionAutoTracker: 位置情報サービスがオフです");
    }
  }

  /// 監視を完全に止める
  Future<void> dispose() async {
    await _idleSub?.cancel();
    _idleSub = null;
    if (_tracker.isTracking) {
      await _tracker.stopTracking(reason: "manual");
    }
  }

  Future<void> _startIdleWatch() async {
    if (_isWatchingIdle) return;
    _isWatchingIdle = true;

    debugPrint("監視開始");

    // distanceFilterをエミュレーター用に0にする　本番はmovementStartDistanceMをセット
    final settings = LocationSettings(
      accuracy: idleAccuracy,
      distanceFilter: testMode ? 0 : movementStartDistanceM,
    );

    _idleSub = Geolocator.getPositionStream(locationSettings: settings).listen(
        (pos) async {
      debugPrint(
          "MotionAutoTracker: 移動検知 lat=${pos.latitude}, lng=${pos.longitude}"); // ★確認用ログ

      onPosition?.call(pos);

      // クールタイム（自動停止後2分以内）のチェック
      if (_lastStoppedTime != null) {
        final cooldown = DateTime.now().difference(_lastStoppedTime!);
        if (cooldown < const Duration(minutes: 2)) {
          debugPrint(
              "自動停止後のクールタイム中のため、トラッキング開始をスキップします (${cooldown.inSeconds}秒経過)");
          return;
        }
      }

      // 監視ストリームを完全に停止・破棄してからトラッキングを開始する
      final subToCancel = _idleSub;
      _idleSub = null;
      _isWatchingIdle = false;
      await subToCancel?.cancel();
      await Future.delayed(const Duration(milliseconds: 200));

      // 5m以上動いたイベントが来た＝歩き出したとみなす
      try {
        final logId = await _tracker.startTracking(patientId);
        debugPrint("MotionAutoTracker: 歩行開始 logId=$logId");
        onTrackingStarted?.call(logId);
      } catch (e) {
        debugPrint("startTracking失敗: $e");
        onTrackingStopped?.call("開始失敗: $e");
        await Future.delayed(const Duration(seconds: 10));
        _startIdleWatch(); // 失敗しても監視に戻る
      }
    }, onError: (e) {
      debugPrint("MotionAutoTracker error $e");
    });
  }

  // 移動を検知したときの処理
  void onMotionDetected() {
    // 自動停止してから2分以内なら無視する（ノイズ対策）
    if (_lastStoppedTime != null) {
      final cooldown = DateTime.now().difference(_lastStoppedTime!);
      if (cooldown < const Duration(minutes: 2)) {
        debugPrint("自動停止後のクールタイム中のため、トラッキング開始をスキップします");
        return;
      }
    }
    // 通常の開始処理
    _tracker.startTracking(patientId);
  }
}

//確認用画面
class GpsTestPage extends StatefulWidget {
  const GpsTestPage({super.key});
  @override
  State<GpsTestPage> createState() => _GpsTestPageState();
}

class _GpsTestPageState extends State<GpsTestPage> {
  late final MotionAutoTracker _tracker;
  String _status = '待機中';
  Position? _pos;
  int _count = 0;
  final List<String> _log = [];

  void _add(String s) {
    if (!mounted) return;
    setState(() => _log.insert(0, '${TimeOfDay.now().format(context)} $s'));
  }

  @override
  void initState() {
    super.initState();
    WalkingTrackerService.offlineMode = false;  // trueなら実機テスト用のトンネルURLを使用する
    WalkingTrackerService.dummyGps = false;     // trueならテストデータを使用する
    _tracker = MotionAutoTracker(patientId: '1')
      ..onPosition = (p) {
        if (!mounted) return;
        setState(() {
          _pos = p;
          _count++;
        });
      }
      ..onTrackingStarted = (id) {
        _add('歩き出し検知→記録開始');
        if (mounted) setState(() => _status = '記録中');
      }
      ..onTrackingStopped = (r) {
        _add('終了: $r');
        if (mounted) setState(() => _status = '監視中');
      };
  }

  @override
  void dispose() {
    _tracker.dispose();
    super.dispose();
  }

  Future<void> _start() async {
    await _tracker.start();
    if (mounted) setState(() => _status = '監視中');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('GPSテスト')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('状態: $_status'),
            Text('受信回数: $_count'),
            Text('緯度: ${_pos?.latitude}'),
            Text('経度: ${_pos?.longitude}'),
            Text('精度: ${_pos?.accuracy} m'),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: _start, child: const Text('GPS開始')),
            const Divider(),
            Expanded(child: ListView(children: _log.map(Text.new).toList())),
          ],
        ),
      ),
    );
  }
}
