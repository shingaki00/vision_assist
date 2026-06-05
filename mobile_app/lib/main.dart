import 'package:flutter/material.dart';
import 'views/login_page.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '障害物検知システム',
      debugShowCheckedModeBanner: false,
      // アプリ全体のテーマをダーク（黒基調）に設定
      theme: ThemeData.light().copyWith(
        scaffoldBackgroundColor: Colors.white,
        primaryColor: Colors.green[700],
      ),
      home: const LoginPage(), 
    );
  }
}
