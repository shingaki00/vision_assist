import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'home_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _idController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();
  bool _isLoading = false;
  String _errorMessage = "";

  void _login() async {
    if (_isLoading) return;

    setState(() {
      _isLoading = true;
      _errorMessage = "";
    });
    
    // 入力された文字を取得
    final id = _idController.text.trim();
    final password = _passwordController.text.trim();

    // AuthServiceを呼び出してチェック
    bool success = await _authService.login(id, password);
    
    setState(() => _isLoading = false);

    if (success && mounted) {
      // ログイン成功したら制御パネルへ
      Navigator.pushReplacement(
        context, 
        MaterialPageRoute(builder: (_) => const HomePage())
      );
    } else if (mounted) {
      setState(() {
        _errorMessage = "IDまたはパスワードが間違っています。";
      });
    }
  }

  @override
  void dispose() {
    _idController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // 全体を元の黒・ダーク系の背景に統一
      backgroundColor: Colors.white,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.lock_outline, color: Colors.green, size: 64),
              const SizedBox(height: 16),
              const Text(
                'デバイス制御システム',
                style: TextStyle(color: Colors.black87, fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 32),
              
              // ID入力欄
              TextField(
                controller: _idController,
                style: const TextStyle(color: Colors.black87), // 入力文字を白に
                decoration: InputDecoration(
                  labelText: 'ユーザーID',
                  labelStyle: const TextStyle(color: Colors.black54),
                  enabledBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.black26)),
                  focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.green)),
                  prefixIcon: const Icon(Icons.person, color: Colors.black54),
                ),
              ),
              const SizedBox(height: 16),
              
              // パスワード入力欄
              TextField(
                controller: _passwordController,
                obscureText: true,
                style: const TextStyle(color: Colors.black87), // 入力文字を白に
                decoration: InputDecoration(
                  labelText: 'パスワード',
                  labelStyle: const TextStyle(color: Colors.black54),
                  enabledBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.black26)),
                  focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.green)),
                  prefixIcon: const Icon(Icons.lock, color: Colors.black54),
                ),
              ),
              const SizedBox(height: 12),
              
              // エラーメッセージ表示
              if (_errorMessage.isNotEmpty)
                Text(_errorMessage, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
              
              const SizedBox(height: 24),
              
              // ログインボタン
              SizedBox(
                width: double.infinity,
                height: 50,
                child: _isLoading 
                  ? const Center(child: CircularProgressIndicator(color: Colors.green))
                  : ElevatedButton(
                      onPressed: _login,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green[700],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('ログイン', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
