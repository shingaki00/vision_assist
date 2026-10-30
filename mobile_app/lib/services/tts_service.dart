import 'package:flutter_tts/flutter_tts.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

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
  
  // 種類ごとに「最後に読んだ時刻」と「そのときの距離区分」を保持する
  final Map<String, DateTime> _lastTimes = {};
  final Map<String, int> _lastBuckets = {};
  static const _cooldown = Duration(seconds: 3);

  int _requestId = 0;

  // 今読んでいる障害物の種類と距離、読み終わる予想時刻
  String _currentType = "";
  double _currentDistance = double.infinity;
  DateTime _speakingUntil = DateTime.fromMillisecondsSinceEpoch(0);

  // 優先度(大きいほど重要) 
  static const Map<String, int> _priorities = {
    "stairs": 2,
    "railway": 2,
    "glass": 1,
    "default": 1,
  };
  int _priorityOf(String type) => _priorities[type] ?? _priorities["default"]!;

  // 「同じ距離」とみなす幅(m)
  static const _sameDistanceTolerance = 0.5;

  // 今読んでいるものの優先度
  int _currentPriority = 0;

  Future<void> init() async {
    await _flutterTts.setLanguage("ja-JP");
    await _flutterTts.setSpeechRate(kIsWeb ? 0.8 : 0.5); // 少しゆっくりめの方が聞き取りやすいです
    await _flutterTts.setVolume(1.0);
    await _flutterTts.setPitch(1.0);
  }

  // 距離を区分に変換
  int _bucketOf(double distance) {
    if (distance <= 1) return 1;
    if (distance <= 2) return 2;
    if (distance <= 3) return 3;
    return 4; // 3mより遠い
  }

  // 読み上げるべきかの判定
  bool _shouldSpeak(String type, double distance) {
    final now = DateTime.now();
    final bucket = _bucketOf(distance);
    final lastTime = _lastTimes[type];
    final lastBucket = _lastBuckets[type];

    // 種類は初めて、またはクールダウンが明けた状態
    if (lastTime == null || lastBucket == null) return true;
    if (now.difference(lastTime) >= _cooldown) return true;

    // 区分が変わったら読む
    if (bucket != lastBucket) return true;
    return false;
  }

  // 読み上げるメッセージの長さから、読み上げにかかる時間を推定
  Duration _estimateDuration(String message) {
    return Duration(milliseconds: message.length * 180 + 500);
  }

  // UIやメインロジックから呼ばれるメソッド
  Future<void> speakObstacle(String type, double distance) async {
    if (!_shouldSpeak(type, distance)) return;

    final now = DateTime.now();
    final priority = _priorityOf(type);
    final isSpeaking = now.isBefore(_speakingUntil);

    if (isSpeaking) {
      final diff = _currentDistance - distance; // プラスなら新しい方が近い
      final isClearlyCloser = diff > _sameDistanceTolerance;
      final isSameDistance = diff.abs() <= _sameDistanceTolerance;
      final isHigherPriority = priority > _currentPriority;

      // 明らかに近い、または同じ距離で優先度が高いときだけ割り込む
      if (!(isClearlyCloser || (isSameDistance && isHigherPriority))) return;

      // 割り込まれる側は、すぐ読み直せるよう記録を消す
      _lastTimes.remove(_currentType);
      _lastBuckets.remove(_currentType);
    }

    _lastTimes[type] = now;
    _lastBuckets[type] = _bucketOf(distance);

    final message = ObstacleMessageGenerator.generate(type, distance);
    _currentType = type;
    _currentDistance = distance;
    _currentPriority = priority;
    _speakingUntil = now.add(_estimateDuration(message));

    final myId = ++_requestId;
    await _flutterTts.stop();
    await Future.delayed(const Duration(milliseconds: 150));
    if (myId != _requestId) return;

    await _flutterTts.speak(message);
  }

  void stop() {
    _requestId++;
    _speakingUntil = DateTime.fromMillisecondsSinceEpoch(0);
    _flutterTts.stop();
  }
}