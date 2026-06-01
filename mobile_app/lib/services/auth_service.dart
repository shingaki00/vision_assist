import 'dart:async';

/// バックエンド担当者と連携するための認証サービス
class AuthService {
  // DB/API連携時のベースURL（例）
  static const String baseUrl = 'https://api.example.com';

  /// ログイン処理
  /// 現在はテスト用。将来的に http パッケージを使用してAPIと通信します。
  Future<bool> login(String id, String password) async {
    // --- 通信のシミュレーション ---
    await Future.delayed(const Duration(seconds: 1));

    // --- テスト用ログイン条件 ---
    // 他の人が設計したDBの初期ユーザーに合わせて変更してください
    if (id == 'adminS' && password == 'password123') {
      return true;
    }
    
    // --- API連携時のイメージ ---
    /*
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      body: {'username': id, 'password': password},
    );
    return response.statusCode == 200;
    */
    
    return false;
  }
}