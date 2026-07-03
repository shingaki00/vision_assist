import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

/// バックエンド担当者と連携するための認証サービス
class AuthService {
  // DB/API連携時のベースURL（例）
  static const String baseUrl = 'https://api.example.com';

  /// ログイン処理
  /// 現在はテスト用。将来的に http パッケージを使用してAPIと通信します。
  Future<bool> login(String mailAddress, String password) async {
    // --- 通信のシミュレーション ---
    await Future.delayed(const Duration(seconds: 1));

    // --- テスト用ログイン条件 ---
    // 他の人が設計したDBの初期ユーザーに合わせて変更してください
    // if (id == 'admin' && password == 'pass') {
    //   return true;
    // }

    final response = await http.post(Uri.parse("http://localhost:3000/login"),
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "mail_address": mailAddress,
          "password": password,
        }));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data["success"];
    }

    // --- API連携時のイメージ ---
    /*
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      body: {'username': id, 'password': password},
    );
    return response.statusCode == 200;
    */
    //登録されたユーザのログイン処理実装する

    return false;
  }
}
