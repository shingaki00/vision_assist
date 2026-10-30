import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image/image.dart' as img;
import 'package:tflite_flutter/tflite_flutter.dart';
import '../services/tts_service.dart';

/// Module: @role: M5Stack CamS3リアルタイム映像受信・YOLOv8物体検知・枠描画・TTS音声案内画面
class Recognition {
  final Rect location; // 0.0〜1.0の正規化座標
  final String label;
  final double score;

  Recognition(this.location, this.label, this.score);
}

class CamS3DetectionPage extends StatefulWidget {
  const CamS3DetectionPage({super.key});

  @override
  State<CamS3DetectionPage> createState() => _CamS3DetectionPageState();
}

class _CamS3DetectionPageState extends State<CamS3DetectionPage> {
  final TextEditingController _urlController =
      TextEditingController(text: 'http://192.168.4.1/api/v1/capture');
  final TtsService _ttsService = TtsService();

  Interpreter? _interpreter;
  List<String> _labels = [];
  bool _isModelLoaded = false;

  Uint8List? _currentFrame;
  List<Recognition> _recognitions = [];
  bool _isDetecting = false;
  bool _isStreaming = false;
  HttpClientRequest? _activeRequest;
  String? _errorMessage;
  bool _isConnecting = false;

  int _imageWidth = 640;
  int _imageHeight = 480;
  final int _inputSize = 640;
  double _confThreshold = 0.25;
  int _lastInferenceTimeMs = 0;
  double _highestScore = 0.0;

  DateTime? _lastSpokenTime;
  String _lastSpokenLabel = '';

  @override
  void initState() {
    super.initState();
    _initAll();
  }

  Future<void> _initAll() async {
    await _ttsService.init();
    await _loadModel();
  }

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

      if (mounted) {
        setState(() {
          _isModelLoaded = true;
        });
        _startStreaming();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'モデル読込失敗: $e';
        });
      }
    }
  }

  Future<void> _startStreaming() async {
    _stopStreaming();
    _isStreaming = true;
    setState(() {
      _isConnecting = true;
      _errorMessage = null;
    });

    final url = Uri.parse(_urlController.text.trim());
    if (url.path.contains('capture')) {
      _runCaptureLoop(url);
    } else {
      _runMjpegStream(url);
    }
  }

  Future<void> _runCaptureLoop(Uri url) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 3);
    if (mounted) {
      setState(() {
        _isConnecting = false;
      });
    }

    while (_isStreaming && mounted) {
      try {
        final request = await client.getUrl(url);
        _activeRequest = request;
        final response = await request.close();

        if (response.statusCode == 200) {
          final builder = await response.fold<BytesBuilder>(
            BytesBuilder(),
            (b, chunk) => b..add(chunk),
          );
          final bytes = builder.takeBytes();

          if (!_isStreaming || !mounted) break;

          setState(() {
            _currentFrame = bytes;
            _errorMessage = null;
          });

          if (!_isDetecting && _isModelLoaded) {
            _runInference(bytes);
          }
        } else {
          if (mounted) {
            setState(() {
              _errorMessage = 'HTTPステータス: ${response.statusCode}';
            });
          }
          await Future.delayed(const Duration(milliseconds: 300));
        }
      } catch (e) {
        if (!_isStreaming) break;
        if (mounted) {
          setState(() {
            _errorMessage = '接続エラー: $e';
          });
        }
        await Future.delayed(const Duration(milliseconds: 500));
      }
    }
    client.close();
  }

  Future<void> _runMjpegStream(Uri url) async {
    try {
      final client = HttpClient()..connectionTimeout = const Duration(seconds: 5);
      _activeRequest = await client.getUrl(url);
      final response = await _activeRequest!.close();

      if (response.statusCode != 200) {
        throw HttpException('HTTPステータス: ${response.statusCode}');
      }

      if (mounted) {
        setState(() {
          _isConnecting = false;
        });
      }

      List<int> buffer = [];

      response.listen(
        (chunk) {
          buffer.addAll(chunk);
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

              if (mounted) {
                setState(() {
                  _currentFrame = jpegBytes;
                  _errorMessage = null;
                });
              }

              if (!_isDetecting && _isModelLoaded) {
                _runInference(jpegBytes);
              }
            }
          }
        },
        onError: (e) {
          if (mounted) {
            setState(() {
              _isConnecting = false;
              _errorMessage = 'ストリーム受信エラー: $e';
            });
          }
        },
        onDone: () {
          if (mounted) {
            setState(() {
              _isConnecting = false;
              _errorMessage = 'ストリーム切断';
            });
          }
        },
        cancelOnError: true,
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _isConnecting = false;
          _errorMessage = '接続失敗: $e';
        });
      }
    }
  }

  void _stopStreaming() {
    _isStreaming = false;
    _activeRequest?.abort();
    _activeRequest = null;
  }

  Future<void> _runInference(Uint8List jpegBytes) async {
    if (_isDetecting || !_isModelLoaded || _interpreter == null) return;
    _isDetecting = true;
    final stopwatch = Stopwatch()..start();

    try {
      final image = img.decodeImage(jpegBytes);
      if (image == null) return;

      final origWidth = image.width;
      final origHeight = image.height;

      final resizedImage = img.copyResize(
        image,
        width: _inputSize,
        height: _inputSize,
      );

      final inputShape = _interpreter!.getInputTensor(0).shape;
      final bool isNCHW = (inputShape[1] == 3);

      final input = isNCHW
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

      final output = List.generate(
        1,
        (_) => List.generate(43, (_) => List.filled(8400, 0.0)),
      );

      _interpreter!.run(input, output);

      final List<Recognition> candidates = [];
      double maxScoreInFrame = 0.0;

      for (int i = 0; i < 8400; i++) {
        double maxScore = 0.0;
        int maxClassId = -1;
        for (int c = 0; c < 39; c++) {
          final double score = output[0][4 + c][i];
          if (score > maxScore) {
            maxScore = score;
            maxClassId = c;
          }
        }

        if (maxScore > maxScoreInFrame) {
          maxScoreInFrame = maxScore;
        }

        if (maxScore >= _confThreshold && maxClassId != -1) {
          double cx = output[0][0][i];
          double cy = output[0][1][i];
          double w = output[0][2][i];
          double h = output[0][3][i];

          // 640ピクセル系・正規化系双方の出力を0.0〜1.0正規化座標へ統一
          if (cx > 1.0 || cy > 1.0 || w > 1.0 || h > 1.0) {
            cx /= _inputSize;
            cy /= _inputSize;
            w /= _inputSize;
            h /= _inputSize;
          }

          final double left = (cx - w / 2.0).clamp(0.0, 1.0);
          final double top = (cy - h / 2.0).clamp(0.0, 1.0);
          final double width = w.clamp(0.0, 1.0 - left);
          final double height = h.clamp(0.0, 1.0 - top);

          final String label = maxClassId < _labels.length
              ? _labels[maxClassId]
              : 'ID:$maxClassId';

          candidates.add(Recognition(
            Rect.fromLTWH(left, top, width, height),
            label,
            maxScore,
          ));
        }
      }

      // 重複矩形を除去（NMS）
      candidates.sort((a, b) => b.score.compareTo(a.score));
      final List<Recognition> results = [];
      for (final candidate in candidates) {
        bool keep = true;
        for (final kept in results) {
          final inter = candidate.location.intersect(kept.location);
          if (inter.width > 0 && inter.height > 0) {
            final double interArea = inter.width * inter.height;
            final double unionArea =
                (candidate.location.width * candidate.location.height) +
                    (kept.location.width * kept.location.height) -
                    interArea;
            if (unionArea > 0 && (interArea / unionArea) > 0.45) {
              keep = false;
              break;
            }
          }
        }
        if (keep) {
          results.add(candidate);
          if (results.length >= 20) break;
        }
      }

      stopwatch.stop();
      if (mounted) {
        _notifyObstacle(results);
        setState(() {
          _imageWidth = origWidth;
          _imageHeight = origHeight;
          _recognitions = results;
          _highestScore = maxScoreInFrame;
          _lastInferenceTimeMs = stopwatch.elapsedMilliseconds;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = '推論エラー: $e';
        });
      }
    } finally {
      _isDetecting = false;
    }
  }

  void _notifyObstacle(List<Recognition> results) {
    if (results.isEmpty) return;
    final now = DateTime.now();
    if (_lastSpokenTime != null &&
        now.difference(_lastSpokenTime!).inSeconds < 3) {
      return;
    }
    final top = results.first;
    if (_lastSpokenLabel == top.label &&
        _lastSpokenTime != null &&
        now.difference(_lastSpokenTime!).inSeconds < 6) {
      return;
    }
    _lastSpokenTime = now;
    _lastSpokenLabel = top.label;
    _ttsService.speakText('前方に${top.label}を検知しました');
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
        title: const Text('CamS3 リアルタイム物体検知'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
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
          // リアルタイム検知ステータスバー
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            color: Colors.grey.shade900,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    _isModelLoaded
                        ? '検知: ${_recognitions.length}件 | 推論: ${_lastInferenceTimeMs}ms | 最高: ${(_highestScore * 100).toStringAsFixed(1)}%'
                        : 'モデル読込中...',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Text(
                  '閾値: ${(_confThreshold * 100).toInt()}%',
                  style:
                      const TextStyle(color: Colors.greenAccent, fontSize: 12),
                ),
              ],
            ),
          ),
          if (_errorMessage != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              color: Colors.red.shade900,
              width: double.infinity,
              child: Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.white, fontSize: 12),
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
                          else ...[
                            const Text('「接続」を押して映像を受信してください'),
                            const SizedBox(height: 16),
                            const Text(
                              '【重要】CamS3はインターネット無しのWi-Fiのため、\nスマホの「モバイルデータ通信(4G/5G)」を一時的にOFFにしてください。',
                              style:
                                  TextStyle(fontSize: 12, color: Colors.orange),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ],
                      ),
                    )
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        return SizedBox(
                          width: constraints.maxWidth,
                          height: constraints.maxHeight,
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              Image.memory(
                                _currentFrame!,
                                gaplessPlayback: true,
                                fit: BoxFit.contain,
                                width: constraints.maxWidth,
                                height: constraints.maxHeight,
                              ),
                              Positioned.fill(
                                child: CustomPaint(
                                  painter: BoundingBoxPainter(
                                    recognitions: _recognitions,
                                    imageSize: Size(
                                      _imageWidth.toDouble(),
                                      _imageHeight.toDouble(),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ),
          // 感度（信頼度しきい値）調整スライダー
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            color: Colors.grey.shade100,
            child: Row(
              children: [
                const Text('検知感度',
                    style: TextStyle(fontSize: 12, color: Colors.black87)),
                Expanded(
                  child: Slider(
                    value: _confThreshold,
                    min: 0.10,
                    max: 0.70,
                    divisions: 12,
                    label: '${(_confThreshold * 100).toInt()}%',
                    onChanged: (val) {
                      setState(() {
                        _confThreshold = val;
                      });
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 映像表示領域に正確に位置合わせしてバウンディングボックスを描画するペインター
class BoundingBoxPainter extends CustomPainter {
  final List<Recognition> recognitions;
  final Size imageSize;

  BoundingBoxPainter({
    required this.recognitions,
    required this.imageSize,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (recognitions.isEmpty || imageSize.width == 0 || imageSize.height == 0) {
      return;
    }

    // BoxFit.contain による画像の実際の描画領域を算出
    final double scale = min(
      size.width / imageSize.width,
      size.height / imageSize.height,
    );
    final double renderedWidth = imageSize.width * scale;
    final double renderedHeight = imageSize.height * scale;
    final double offsetX = (size.width - renderedWidth) / 2.0;
    final double offsetY = (size.height - renderedHeight) / 2.0;

    final boxPaint = Paint()
      ..color = Colors.greenAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5;

    final fillPaint = Paint()
      ..color = Colors.greenAccent.withValues(alpha: 0.15)
      ..style = PaintingStyle.fill;

    for (final reg in recognitions) {
      final Rect rect = Rect.fromLTWH(
        offsetX + reg.location.left * renderedWidth,
        offsetY + reg.location.top * renderedHeight,
        reg.location.width * renderedWidth,
        reg.location.height * renderedHeight,
      );

      canvas.drawRect(rect, fillPaint);
      canvas.drawRect(rect, boxPaint);

      final textSpan = TextSpan(
        text: ' ${reg.label} ${(reg.score * 100).toStringAsFixed(0)}% ',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 13,
          fontWeight: FontWeight.bold,
          backgroundColor: Colors.black87,
        ),
      );
      final textPainter = TextPainter(
        text: textSpan,
        textDirection: TextDirection.ltr,
      )..layout();

      final labelTop = max(offsetY, rect.top - textPainter.height);
      textPainter.paint(canvas, Offset(rect.left, labelTop));
    }
  }

  @override
  bool shouldRepaint(covariant BoundingBoxPainter oldDelegate) => true;
}
