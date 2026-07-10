// 歩き出し検知→記録開始→自動終了→また歩き出し検知に戻るサイクル全体を管理する
import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'walking_tracker_service.dart';

/// 歩き出しを自動検知して記録を開始し、止まったら自動終了する。
/// 画面側はこのクラスを1つ持つだけでよい。
class MotionAutoTracker {
  static const int movementStartDistanceM = 5; // これ以上動いたら「歩き出した」とみなす
  static const LocationAccuracy idleAccuracy = LocationAccuracy.medium; // 待機中は省電力

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

  /// 監視を開始する。画面が開いたタイミングで1回呼ぶ想定。
  Future<void> start() => _startIdleWatch();

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

    const settings = LocationSettings(
      accuracy: idleAccuracy,
      distanceFilter: movementStartDistanceM,
    );

    _idleSub = Geolocator.getPositionStream(locationSettings: settings).listen((_) async {
      // 5m以上動いたイベントが来た＝歩き出したとみなす
      await _idleSub?.cancel();
      _idleSub = null;
      _isWatchingIdle = false;

      final logId = await _tracker.startTracking(patientId);
      onTrackingStarted?.call(logId);
    });
  }
}
