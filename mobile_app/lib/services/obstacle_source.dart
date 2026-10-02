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
      ObstacleEvent("glass", 2),
      ObstacleEvent("railway", 5),
    ];
    var i = 0;
    _timer = Timer.periodic(const Duration(seconds: 3), (_) {
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