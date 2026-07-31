// 1件のログを表すクラス
class LogModel {
  final int id;

  final int logId;
  // 緯度
  final double latitude;

  // 経度
  final double longitude;

  // 保存日時
  final String timestamp;

  // コンストラクタ
  LogModel({
    required this.id,
    required this.logId,
    required this.latitude,
    required this.longitude,
    required this.timestamp,
  });

  // Node.jsから受け取ったJSONを
  // LogModelへ変換する
  factory LogModel.fromJson(Map<String, dynamic> json) {
    return LogModel(
      id: int.parse(json["id"].toString()),
      logId: int.parse(json["log_id"].toString()),
      latitude: double.parse(json["latitude"].toString()),
      longitude: double.parse(json["longitude"].toString()),
      timestamp: json["created_at"].toString(),
    );
  }
}
