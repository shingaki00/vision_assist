import 'package:flutter_tts/flutter_tts.dart';

// 1. 通知ロジックを定義するクラス（責務の分離）
class ObstacleMessageGenerator {
  // ルールを追加
  static final Map<String, String Function(double)> _templates = {
    "stairs": (dist) => "${dist.toInt()}メートル先に階段があります。",
    "glass": (dist) => "${dist.toInt()}メートル先にガラスがあります。",
    "railway": (dist) => "${dist.toInt()}メートル先に線路があります。注意してください。",
    "default": (dist) => "前方、${dist.toInt()}メートルに障害物があります。",
  };

  static String generate(String type, double distance) {
    final generator = _templates[type] ?? _templates["default"]!;
    return generator(distance);
  }
}

// 2. TTS操作を担当するクラス
class TtsService {
  final FlutterTts _flutterTts = FlutterTts();

  // 連続読み上げ防止用
  String _lastKey = "";
  DateTime _lastTime = DateTime.fromMillisecondsSinceEpoch(0);
  static const _cooldown = Duration(seconds: 2);

  Future<void> init() async {
    await _flutterTts.setLanguage("ja-JP");
    await _flutterTts.setSpeechRate(0.8); // 少しゆっくりめの方が聞き取りやすいです
    await _flutterTts.setVolume(1.0);
    await _flutterTts.setPitch(1.0);
  }

  // UIやメインロジックから呼ばれるメソッド
  Future<void> speakObstacle(String type, double distance) async {
    // 同じ種類・同じ距離が短時間に連続したら無視
    final key = "$type:${distance.toInt()}";
    final now = DateTime.now();
    if (key == _lastKey && now.difference(_lastTime) < _cooldown) return;
    _lastKey = key;
    _lastTime = now;

    // 割り込みを防ぐため、再生前に一度ストップする（任意）
    await _flutterTts.stop();
    final message = ObstacleMessageGenerator.generate(type, distance);
    await _flutterTts.speak(message);
  }

  void stop() {
    _flutterTts.stop();
  }
}