// 歩き出し検知→記録開始→自動終了→また歩き出し検知に戻るサイクル全体を管理する
import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'walking_tracker_service.dart';

/// 歩き出しを自動検知して記録を開始し、止まったら自動終了する。
/// 画面側はこのクラスを1つ持つだけでよい。
class MotionAutoTracker {
  static const int movementStartDistanceM = 5; // これ以上動いたら「歩き出した」とみなす
  static const LocationAccuracy idleAccuracy = LocationAccuracy.high; // 待機中は省電力

  final WalkingTrackerService _tracker;
  final String patientId;

  StreamSubscription<Position>? _idleSub;
  bool _isWatchingIdle = false;

  void Function(int logId)? onTrackingStarted;
  void Function(String reason)? onTrackingStopped;

  MotionAutoTracker({required this.patientId}) : _tracker = WalkingTrackerService() {
    _tracker.onStopped = (reason) {
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

  /// 監視を完全に止める（画面を閉じる時など）
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
    const settings = LocationSettings(
      accuracy: idleAccuracy,
      distanceFilter: 0,
    );

    _idleSub = Geolocator.getPositionStream(locationSettings: settings).listen((pos) async {
      debugPrint("MotionAutoTracker: 移動検知 lat=${pos.latitude}, lng=${pos.longitude}"); // ★確認用ログ

      // 5m以上動いたイベントが来た＝歩き出したとみなす
      await _idleSub?.cancel();
      _idleSub = null;
      _isWatchingIdle = false;

      final logId = await _tracker.startTracking(patientId);
      debugPrint("MotionAutoTracker: 歩行開始 logId=$logId"); 
      onTrackingStarted?.call(logId);
    },
    onError: (e) {
      debugPrint("MotionAutoTracker error $e");
    });
  }
}
