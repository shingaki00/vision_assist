"""
カメラ+YOLOで「何があるか」(人 or 物)を判定し、超音波センサーで「どれだけ近いか」を測る、
役割分担型の障害物検知スクリプト（デバッグログ・通信安全対策強化版）。

事前準備:
    pip install ultralytics opencv-python pyserial requests pillow numpy
"""

import os
import time
from urllib.parse import urlparse
from io import BytesIO
import requests
from PIL import Image
import cv2
import numpy as np
from ultralytics import YOLO

from serial_link import UltrasonicLink

# ===== 設定 =====
SERIAL_PORT = "COM3"                                   # M5StickC Plus2が繋がっているシリアルポート
CAMERA_SOURCE = os.environ.get("CAMERA_SOURCE", "http://192.168.4.1/api/v1/capture")

OBSTACLE_ALERT_DISTANCE_CM = 200.0   # 物(人以外)はこの距離より近ければ警告(約2m)
PERSON_ALERT_DISTANCE_CM = 100.0     # 人はこの距離より近ければ警告(50〜100cmの範囲で調整可)
CENTER_OFFSET_RATIO = 0.3            # 画面中央からのズレがこの割合以下なら「正面」とみなす
BEEP_COOLDOWN_SEC = 1.0              # 連続で鳴らしすぎないための最短間隔


def find_largest_centered(results, frame_w, frame_h, center_offset_ratio, want_person, person_classes=["person"]):
    """画面中央付近にある物体のうち、指定した種類(人 or 人以外)で一番大きいものを探す。
    見つからなければNoneを返す。
    """
    best_name = None
    best_area_ratio = 0.0
    center_x = frame_w / 2

    for box in results.boxes:
        class_name = results.names[int(box.cls[0])]
        is_person = (class_name in person_classes)
        if is_person != want_person:
            continue

        x1, y1, x2, y2 = box.xyxy[0]
        box_center_x = (x1 + x2) / 2
        offset_ratio = abs(box_center_x - center_x) / frame_w
        if offset_ratio > center_offset_ratio:
            continue

        area_ratio = ((x2 - x1) * (y2 - y1)) / (frame_w * frame_h)
        if area_ratio > best_area_ratio:
            best_area_ratio = area_ratio
            best_name = class_name

    return best_name


def main():
    person_classes = ["person"]

    print("========================================")
    print(f"[1/3] 超音波センサー({SERIAL_PORT})に接続中...")
    try:
        link = UltrasonicLink(SERIAL_PORT)
        print("  └─ [成功] 超音波センサーに接続しました！")
    except Exception as e:
        print(f"  └─ [エラー] シリアルポート '{SERIAL_PORT}' に接続できませんでした: {e}")
        print("     SERIAL_PORTの設定やマイコンの接続を確認してください。")
        return

    print("[2/3] YOLOモデル(best.pt)を読み込み中...")
    try:
        model = YOLO("best.pt")
        model = YOLO("yolov8n.pt")
        print("  └─ [成功] YOLOモデルの読み込みが完了しました！")
    except Exception as e:
        print(f"  └─ [エラー] モデルの読み込みに失敗しました: {e}")
        print("     実行フォルダ内に 'best.pt' が存在するか確認してください。")
        link.close()
        return

    print("[3/3] メイン処理ループを開始します... (終了するには画面で 'q' キーを押してください)")
    print("========================================")

    last_beep_time = 0.0
    consecutive_camera_errors = 0

    try:
        while True:
            time.sleep(0.03)

            # 1. カメラ画像取得
            try:
                # タイムアウトを3秒に設定して接続待ちでのフリーズを防止
                resp = requests.get(CAMERA_SOURCE, timeout=3.0)
                resp.raise_for_status()
                img = Image.open(BytesIO(resp.content))
                consecutive_camera_errors = 0  # 成功したらエラーカウントをリセット
            except Exception as e:
                consecutive_camera_errors += 1
                if consecutive_camera_errors % 10 == 1:  # ログが埋まらないよう定期的に表示
                    print(f"[警告] カメラ画像取得失敗 ({consecutive_camera_errors}回目): Wi-Fi接続やIPアドレスを確認してください。")
                continue

            # 2. センサー距離取得
            distance_cm = link.get_distance_cm()

            # 3. YOLOでの物体認識
            result = model.predict(img, verbose=False)[0]
            h, w = result.orig_shape

            # 4. 正面にある対象の識別
            person_label = find_largest_centered(result, w, h, CENTER_OFFSET_RATIO, want_person=True, person_classes=person_classes)
            obstacle_label = find_largest_centered(result, w, h, CENTER_OFFSET_RATIO, want_person=False, person_classes=person_classes)

            # 5. 警告フラグの計算
            person_close = (
                person_label is not None
                and distance_cm is not None
                and distance_cm < PERSON_ALERT_DISTANCE_CM
            )

            obstacle_close = (
                obstacle_label is not None
                and distance_cm is not None
                and distance_cm < OBSTACLE_ALERT_DISTANCE_CM
            )
            unclassified_close = (
                person_label is None
                and obstacle_label is None
                and distance_cm is not None
                and distance_cm < OBSTACLE_ALERT_DISTANCE_CM
            )

            now = time.time()
            can_beep = (now - last_beep_time) > BEEP_COOLDOWN_SEC

            # 6. 警告判定とブザー要求
            dist_str = f"{distance_cm:.0f}cm" if distance_cm is not None else "距離不明"

            if person_close:
                print(f"[警告] 前方に人: ぶつかりそうです ({dist_str})")
                if can_beep:
                    link.request_beep(kind="person", duration_ms=120)
                    last_beep_time = now
            elif obstacle_close in ["Stairs","Trench"]:
                print(f"[警告] 進行方向に障害物: {obstacle_label} ({dist_str})")
                if can_beep:
                    link.request_beep(kind="obstacle", duration_ms=120)
                    last_beep_time = now
            elif unclassified_close:
                print(f"[警告] 進行方向に障害物 ({dist_str}) ※種類は未判定")
                if can_beep:
                    link.request_beep(kind="obstacle", duration_ms=120)
                    last_beep_time = now

            # 7. 画面表示
            cv2.imshow("Obstacle Detection", result.plot())
            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("終了リクエストを受け取りました。")
                break

    finally:
        cv2.destroyAllWindows()
        link.close()
        print("プログラムを正常に終了しました。")


if __name__ == "__main__":
    main()