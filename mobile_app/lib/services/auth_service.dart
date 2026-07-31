import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';

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
      String mailAddress, String password, String login_id) async {
    // --- 通信のシミュレーション ---
    await Future.delayed(const Duration(seconds: 1));

    // --- テスト用ログイン条件 ---
    // 他の人が設計したDBの初期ユーザーに合わせて変更してください
    debugPrint("mail = $mailAddress");
    debugPrint("pass = $password");
    final response =
        await http.post(Uri.parse("http://10.0.2.2:3000/patient/login"),
            headers: {
              "Content-Type": "application/json",
            },
            body: jsonEncode({
              "mail_address": mailAddress,
              "password_hash": password,
            }));
    debugPrint("status = ${response.statusCode}");
    debugPrint("body = ${response.body}");
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _patientId = data["patient_id"].toString();
      return data["success"];
    }

    // --- API連携時のイメージ ---
    /*
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      body: {'username': id, 'password': password},
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _patientId = data['patient_id']; // ★patientIdを受け取る
      return true;
    }
    */
    return false;
  }

  String? getpatientId() => _patientId;
}
