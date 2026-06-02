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
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: Colors.black87,
        primaryColor: Colors.greenAccent,
      ),
      home: const LoginPage(), 
    );
  }
}