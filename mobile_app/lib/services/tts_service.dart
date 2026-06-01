import 'package:flutter_tts/flutter_tts.dart';

class TtsService {
  final FlutterTts _flutterTts = FlutterTts();

  // 音声読み上げの初期設定
  Future<void> init() async {
    await _flutterTts.setLanguage("ja-JP"); // 言語を日本語に設定
    await _flutterTts.setSpeechRate(1.5);   // 読み上げ速度 (0.0 〜 1.5)
    await _flutterTts.setVolume(1.0);       // 音量 (0.0 〜 1.0)
    await _flutterTts.setPitch(1.0);        // 声の高さ (0.5 〜 2.0)
  }

  // 障害物に応じたアナウンスの生成と再生
  Future<void> speakObstacle(String type, double distance) async {
    String message = "";
    
    if (type == "stairs") {
      message = "${distance.toInt()}メートル先に階段があります。";
    } else if (type == "railway") {
      message = "${distance.toInt()}メートル先に線路があります。注意してください。";
    } else {
      message = "前方、${distance}メートルに障害物があります。";
    }

    await _flutterTts.speak(message);
  }

  // 音声を安全に停止
  void stop() {
    _flutterTts.stop();
  }
}