from ultralytics import YOLO

# モデルの読み込み
model = YOLO('vidvipo_yolov8n_2023-05-19.pt')

# TFLite形式（Float16軽量化付き）に変換
model.export(format='tflite', int8=False, half=True)