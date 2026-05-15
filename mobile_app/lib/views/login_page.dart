import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'home_page.dart'; // ← 追加したホーム画面を読み込む

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _idController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();
  
  bool _isLoading = false;
  bool _isObscure = true;

  // ログイン処理の実行
  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      // AuthServiceを使って判定（admin / password123 でテスト可能）
      final success = await _authService.login(
        _idController.text,
        _passwordController.text,
      );

      if (!mounted) return;

      if (success) {
        // 【重要】成功したらメインページへ移動
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const HomePage()),
        );
      } else {
        // 失敗したらエラーを表示
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('IDまたはパスワードが違います\n(テスト用: admin / password123)'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const Icon(Icons.lock_person_rounded, size: 80, color: Colors.indigo),
                  const SizedBox(height: 20),
                  const Text('Member Login', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 40),
                  
                  TextFormField(
                    controller: _idController,
                    decoration: const InputDecoration(
                      labelText: 'ユーザーID',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'IDを入力してください' : null,
                  ),
                  const SizedBox(height: 20),
                  
                  TextFormField(
                    controller: _passwordController,
                    obscureText: _isObscure,
                    decoration: InputDecoration(
                      labelText: 'パスワード',
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_isObscure ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _isObscure = !_isObscure),
                      ),
                      border: const OutlineInputBorder(),
                    ),
                    validator: (v) => (v == null || v.isEmpty) ? 'パスワードを入力してください' : null,
                  ),
                  const SizedBox(height: 30),
                  
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.indigo,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: _isLoading 
                        ? const CircularProgressIndicator(color: Colors.white)
                        : const Text('ログイン', style: TextStyle(fontSize: 16)),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text('※ アカウントは管理者が発行します。', style: TextStyle(color: Colors.grey, fontSize: 12)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}