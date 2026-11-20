import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'walking_tracker_service.dart';

/// バックエンド担当者と連携するための認証サービス
class AuthService {
  // 画面が変わっても同じログイン状態を参照できるようにする
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  // DB/API連携時のベースURL（例）
  static const String baseUrl = 'https://api.example.com';

  // 現在ログイン中のpatientId
  String? _patientId;

  /// ログイン処理
  /// 現在はテスト用。将来的に http パッケージを使用してAPIと通信します。
  Future<bool> login(
      String mailAddress, String password, String loginId) async {
    // --- 通信のシミュレーション ---
    await Future.delayed(const Duration(seconds: 1));

    debugPrint("mail = $mailAddress");
    debugPrint("pass = $password");

    // トンネルのURL(hostOverride)があればそれを使う。無ければ自動切替
    final String baseUrl = WalkingTrackerService().apiBase;

    // ログイン処理内
    final response = await http.post(
      Uri.parse("$baseUrl/patient/login"),
      headers: {
        "Content-Type": "application/json",
      },
      body: jsonEncode({
        "mail_address": mailAddress,
        "password_hash": password,
      }),
    ).timeout(const Duration(seconds: 10));
    debugPrint("status = ${response.statusCode}");
    debugPrint("body = ${response.body}");

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _patientId = data["patient_id"].toString();
      return data["success"];
    }

    return false;
  }

  String? getpatientId() => _patientId;
}
