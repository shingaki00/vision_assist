// 障害物イベントが流れてくる受信部分
import 'dart:async';

class ObstacleEvent {
  final String type;
  final double distance;
  ObstacleEvent(this.type, this.distance);
}

abstract class ObstacleSource {
  Stream<ObstacleEvent> get stream;
  void dispose();
}

/// 仮:3秒ごとにダミーデータを流す
class DummyObstacleSource implements ObstacleSource {
  final _controller = StreamController<ObstacleEvent>.broadcast();
  Timer? _timer;

  DummyObstacleSource() {
    final dummy = [
        ObstacleEvent("stairs", 3),
        ObstacleEvent("stairs", 3),   // 同じ → 読まない
        ObstacleEvent("stairs", 2),   // 2区分に近づいた → 読む
        ObstacleEvent("stairs", 2),   // 同じ → 読まない
        ObstacleEvent("stairs", 1),   // 1区分に近づいた → 読む
        ObstacleEvent("glass", 2),
        ObstacleEvent("stairs", 2),
        ObstacleEvent("railway", 4),
        ObstacleEvent("railway", 3),
    ];
    var i = 0;
    _timer = Timer.periodic(const Duration(milliseconds: 2000), (_) {
      _controller.add(dummy[i++ % dummy.length]);
    });
  }

  @override
  Stream<ObstacleEvent> get stream => _controller.stream;

  @override
  void dispose() {
    _timer?.cancel();
    _controller.close();
  }
}