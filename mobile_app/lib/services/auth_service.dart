import 'dart:async';

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
  Future<bool> login(String id, String password) async {
    // --- 通信のシミュレーション ---
    await Future.delayed(const Duration(seconds: 1));

    // --- テスト用ログイン条件 ---
    // 他の人が設計したDBの初期ユーザーに合わせて変更してください
    if (id == 'admin' && password == 'pass') {
      _patientId = '1';
      return true;
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

  void logout() {
    _patientId = null;
  }
}
