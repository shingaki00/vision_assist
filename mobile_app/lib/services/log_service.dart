import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../models/log_model.dart';

class LogService {
  // Node.jsのURL
  static const String apiUrl = "http://192.168.1.10:3000/logs";

  // ログ取得
  Future<List<LogModel>> fetchLogs() async {
    // Node.jsへGET通信
    final jsonData = await rootBundle.loadString(
      '../../../admin_web/testData.json',
    );
    //final response = await http.get(Uri.parse(apiUrl));

    // 通信成功

    print("JSON読み込み成功");
    print(jsonData);

    //if (response.statusCode == 200) {
    // JSONへ変換
    //List json = jsonDecode(response.body);
    final Map<String, dynamic> json = jsonDecode(jsonData);

    final List gpsData = json["gpsData"];

    // LogModelへ変換
    return gpsData.map((e) => LogModel.fromJson(e)).toList();
    //}

    throw Exception("取得失敗");
  }
}
