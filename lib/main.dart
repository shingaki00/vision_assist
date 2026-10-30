import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vision Assist',
      theme: ThemeData.dark(),
      home: const VisionAssistScreen(),
    );
  }
}

// 検出結果のデータ構造
class Recognition {
  final Rect location;
  final String label;
  final double score;

  Recognition(this.location, this.label, this.score);
}

class VisionAssistScreen extends StatefulWidget {
  const VisionAssistScreen({super.key});

  @override
  State<VisionAssistScreen> createState() => _VisionAssistScreenState();
}

class _VisionAssistScreenState extends State<VisionAssistScreen> {
  // ★CamS3のIPアドレス（ブラウザで確認したストリームURLに合わせて変更してください）
  final TextEditingController _urlController =
      TextEditingController(text: 'http://192.168.4.1/stream');

  Interpreter? _interpreter;
  List<String> _labels = [];
  bool _isModelLoaded = false;

  Uint8List? _currentFrame;
  List<Recognition> _recognitions = [];
  bool _isDetecting = false;
  HttpClientRequest? _activeRequest;
  String? _errorMessage;
  bool _isConnecting = false;

  final int _inputSize = 640;
  final double _confThreshold = 0.35; // 信頼度のしきい値

  @override
  void initState() {
    super.initState();
    _loadModel();
  }

  // モデルとラベルの読み込み
  Future<void> _loadModel() async {
    try {
      _interpreter = await Interpreter.fromAsset(
        'assets/models/vidvipo_yolov8n.tflite',
        options: InterpreterOptions()..threads = 4,
      );
      final labelData = await rootBundle.loadString('assets/models/labels.txt');
      _labels = labelData
          .split('\n')
          .map((e) => e.trim())
          .where((e) => e.isNotEmpty)
          .toList();

      setState(() {
        _isModelLoaded = true;
      });
      print('モデルとラベルの読み込みに成功しました (${_labels.length} クラス)');
      _startStreaming();
    } catch (e) {
      print('モデル読み込みエラー: $e');
    }
  }

  // CamS3のMJPEGストリームの開始
  Future<void> _startStreaming() async {
    _stopStreaming();
    setState(() {
      _isConnecting = true;
      _errorMessage = null;
    });
    final url = Uri.parse(_urlController.text.trim());

    try {
      final client = HttpClient()
        ..connectionTimeout = const Duration(seconds: 5);
      _activeRequest = await client.getUrl(url);
      final response = await _activeRequest!.close();

      if (response.statusCode != 200) {
        throw HttpException('HTTPステータス: ${response.statusCode}');
      }

      setState(() {
        _isConnecting = false;
      });

      List<int> buffer = [];

      response.listen(
        (chunk) {
          buffer.addAll(chunk);

          // バッファ肥大化防止（5MB超過時はクリア）
          if (buffer.length > 5 * 1024 * 1024) {
            buffer.clear();
            return;
          }

          int startIndex = -1;
          for (int i = 0; i < buffer.length - 1; i++) {
            if (buffer[i] == 0xFF && buffer[i + 1] == 0xD8) {
              startIndex = i;
              break;
            }
          }

          if (startIndex != -1) {
            if (startIndex > 0) {
              buffer = buffer.sublist(startIndex);
              startIndex = 0;
            }

            int endIndex = -1;
            for (int i = startIndex; i < buffer.length - 1; i++) {
              if (buffer[i] == 0xFF && buffer[i + 1] == 0xD9) {
                endIndex = i + 2;
                break;
              }
            }

            if (endIndex != -1) {
              final jpegBytes =
                  Uint8List.fromList(buffer.sublist(startIndex, endIndex));
              buffer = buffer.sublist(endIndex);

              setState(() {
                _currentFrame = jpegBytes;
                _errorMessage = null;
              });

              if (!_isDetecting && _isModelLoaded) {
                _runInference(jpegBytes);
              }
            }
          }
        },
        onError: (e) {
          setState(() {
            _isConnecting = false;
            _errorMessage = 'ストリーム受信エラー: $e';
          });
        },
        onDone: () {
          setState(() {
            _isConnecting = false;
            _errorMessage = 'ストリームが切断されました';
          });
        },
        cancelOnError: true,
      );
    } catch (e) {
      setState(() {
        _isConnecting = false;
        _errorMessage = '接続失敗: $e';
      });
      print('ストリーム接続エラー: $e');
    }
  }

  void _stopStreaming() {
    _activeRequest?.abort();
    _activeRequest = null;
  }

  // YOLOv8推論処理
  Future<void> _runInference(Uint8List jpegBytes) async {
    _isDetecting = true;
    try {
      final image = img.decodeImage(jpegBytes);
      if (image == null || _interpreter == null) return;

      final origWidth = image.width;
      final origHeight = image.height;

      // 640x640にリサイズ
      final resizedImage = img.copyResize(
        image,
        width: _inputSize,
        height: _inputSize,
      );

      // モデルの入力テンソル形状に合わせてデータ整形
      // [1, 640, 640, 3] または [1, 3, 640, 640]
      var inputShape = _interpreter!.getInputTensor(0).shape;
      bool isNCHW = (inputShape[1] == 3);

      var input = isNCHW
          ? List.generate(
              1,
              (_) => List.generate(
                3,
                (c) => List.generate(
                  _inputSize,
                  (y) => List.generate(_inputSize, (x) {
                    final pixel = resizedImage.getPixel(x, y);
                    if (c == 0) return pixel.r / 255.0;
                    if (c == 1) return pixel.g / 255.0;
                    return pixel.b / 255.0;
                  }),
                ),
              ),
            )
          : List.generate(
              1,
              (_) => List.generate(
                _inputSize,
                (y) => List.generate(_inputSize, (x) {
                  final pixel = resizedImage.getPixel(x, y);
                  return [
                    pixel.r / 255.0,
                    pixel.g / 255.0,
                    pixel.b / 255.0,
                  ];
                }),
              ),
            );

      // 出力バッファ: [1, 43, 8400]
      var output = List.generate(
        1,
        (_) => List.generate(43, (_) => List.filled(8400, 0.0)),
      );

      _interpreter!.run(input, output);

      // YOLOv8出力の解析（43行 x 8400列）
      List<Recognition> results = [];
      for (int i = 0; i < 8400; i++) {
        // クラススコア最大値を探す (行4〜42)
        double maxScore = 0;
        int maxClassId = -1;
        for (int c = 0; c < 39; c++) {
          double score = output[0][4 + c][i];
          if (score > maxScore) {
            maxScore = score;
            maxClassId = c;
          }
        }

        if (maxScore > _confThreshold && maxClassId != -1) {
          // 中心x, 中心y, 幅w, 高さh (640スケール)
          double cx = output[0][0][i];
          double cy = output[0][1][i];
          double w = output[0][2][i];
          double h = output[0][3][i];

          // 元の画像サイズ比率にスケール変換
          double left = ((cx - w / 2) / _inputSize) * origWidth;
          double top = ((cy - h / 2) / _inputSize) * origHeight;
          double width = (w / _inputSize) * origWidth;
          double height = (h / _inputSize) * origHeight;

          String label = maxClassId < _labels.length
              ? _labels[maxClassId]
              : 'ID:$maxClassId';

          results.add(Recognition(
            Rect.fromLTWH(left, top, width, height),
            label,
            maxScore,
          ));
        }
      }

      setState(() {
        _recognitions = results;
      });
    } catch (e) {
      print('推論エラー: $e');
    } finally {
      _isDetecting = false;
    }
  }

  @override
  void dispose() {
    _stopStreaming();
    _interpreter?.close();
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Vision Assist (CamS3)'),
        backgroundColor: Colors.black,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _urlController,
                    decoration: const InputDecoration(
                      labelText: 'CamS3 Stream URL',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _startStreaming,
                  child: const Text('接続'),
                ),
              ],
            ),
          ),
          Expanded(
            child: Center(
              child: _currentFrame == null
                  ? Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (_isConnecting)
                            const CircularProgressIndicator()
                          else if (_errorMessage != null) ...[
                            Text(
                              _errorMessage!,
                              style: const TextStyle(color: Colors.redAccent),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            ElevatedButton(
                              onPressed: _startStreaming,
                              child: const Text('再試行'),
                            ),
                          ] else
                            const Text('「接続」を押して映像を受信してください'),
                          const SizedBox(height: 16),
                          const Text(
                            '【重要】CamS3はインターネット無しのWi-Fiのため、\nスマホの「モバイルデータ通信(4G/5G)」を一時的にOFFにしてください。',
                            style: TextStyle(fontSize: 12, color: Colors.amberAccent),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        return Stack(
                          alignment: Alignment.center,
                          children: [
                            Image.memory(
                              _currentFrame!,
                              gaplessPlayback: true,
                              fit: BoxFit.contain,
                            ),
                            Positioned.fill(
                              child: CustomPaint(
                                painter: BoundingBoxPainter(_recognitions),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// 検出枠を描画するカスタムペインター
class BoundingBoxPainter extends CustomPainter {
  final List<Recognition> recognitions;

  BoundingBoxPainter(this.recognitions);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.greenAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;

    final textStyle = const TextStyle(
      color: Colors.white,
      fontSize: 14,
      backgroundColor: Colors.black87,
    );

    for (final reg in recognitions) {
      canvas.drawRect(reg.location, paint);

      final textSpan = TextSpan(
        text: ' ${reg.label} ${(reg.score * 100).toStringAsFixed(0)}% ',
        style: textStyle,
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();

      textPainter.paint(
        canvas,
        Offset(reg.location.left, max(0, reg.location.top - 20)),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}