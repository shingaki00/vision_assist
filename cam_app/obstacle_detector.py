"""
カメラ+YOLOで「何があるか」(人 or 物)を判定し、超音波センサーで「どれだけ近いか」を測る、
役割分担型の障害物検知スクリプト。

人と物でしきい値・鳴らす音を分けている:
    - 物(人以外):  OBSTACLE_ALERT_DISTANCE_CM より近ければ警告
    - 人:          PERSON_ALERT_DISTANCE_CM より近ければ警告(物より近い距離でのみ警告)

事前準備:
    pip install ultralytics opencv-python pyserial

使い方:
    下の「設定」を環境に合わせて変更してから実行する。
    - SERIAL_PORT: M5StickC Plus2が繋がっているシリアルポート
    - CAMERA_SOURCE: 0ならPC内蔵Webカメラ。
      IP Webcam(スマホ)を使う場合は "http://<スマホのIPアドレス>:8080/video" のような
      文字列に変更する(スマホ側でアプリを起動し「Start server」を押した後に
      表示されるIPアドレスを使う。PCとスマホは同じWiFiに接続しておくこと)
"""

import time

import cv2
from ultralytics import YOLO

from serial_link import UltrasonicLink

# ===== 設定 =====
SERIAL_PORT = "COM3"
CAMERA_SOURCE = 0  # PC内蔵Webカメラ(IP Webcamを使う場合は "http://<スマホのIP>:8080/video" に変更)

OBSTACLE_ALERT_DISTANCE_CM = 200.0   # 物(人以外)はこの距離より近ければ警告(約2m)
PERSON_ALERT_DISTANCE_CM = 100.0     # 人はこの距離より近ければ警告(50〜100cmの範囲で調整可)
CENTER_OFFSET_RATIO = 0.3            # 画面中央からのズレがこの割合以下なら「正面」とみなす
BEEP_COOLDOWN_SEC = 1.0              # 連続で鳴らしすぎないための最短間隔
INFERENCE_INTERVAL_SEC = 0.01         # 推論頻度を最大約10回/秒に制限


def find_largest_centered(results, frame_w, frame_h, center_offset_ratio, want_person):
    """画面中央付近にある物体のうち、指定した種類(人 or 人以外)で一番大きいものを探す。
    見つからなければNoneを返す。
    """
    best_name = None
    best_area_ratio = 0.0
    center_x = frame_w / 2

    for box in results.boxes:
        class_name = results.names[int(box.cls[0])]
        is_person = (class_name == "person")
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
    print("超音波センサーに接続中...")
    try:
        link = UltrasonicLink(SERIAL_PORT)
    except Exception as e:
        print(f"シリアルポート '{SERIAL_PORT}' に接続できませんでした: {e}")
        print("SERIAL_PORTの設定を確認してください。")
        return

    print("[2/3] YOLOモデル(best.pt)を読み込み中...")
    try:
        model_path = os.path.join(os.path.dirname(__file__), "best.pt")
        model = YOLO(model_path)
        print("  └─ [成功] YOLOモデルの読み込みが完了しました！")
    except Exception as e:
        print(f"  └─ [エラー] モデルの読み込みに失敗しました: {e}")
        print("     実行フォルダ内に 'best.pt' が存在するか確認してください。")
        link.close()
        return

    last_beep_time = 0.0

    try:
        while True:
            time.sleep(INFERENCE_INTERVAL_SEC)

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

            distance_cm = link.get_distance_cm()

            # 3. YOLOでの物体認識
            result = model.predict(img, verbose=False, imgsz=416)[0]
            h, w = result.orig_shape

            # 4. 正面にある対象の識別
            person_label = find_largest_centered(result, w, h, CENTER_OFFSET_RATIO, want_person=True, person_classes=person_classes)
            obstacle_label = find_largest_centered(result, w, h, CENTER_OFFSET_RATIO, want_person=False, person_classes=person_classes)

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
            # YOLOが何も認識できなくても、超音波が近いと言っていれば警告だけは出す
            unclassified_close = (
                person_label is None
                and obstacle_label is None
                and distance_cm is not None
                and distance_cm < OBSTACLE_ALERT_DISTANCE_CM
            )

            now = time.time()
            can_beep = (now - last_beep_time) > BEEP_COOLDOWN_SEC

            if person_close:
                print(f"前方に人: ぶつかりそうです ({distance_cm:.0f}cm)")
                if can_beep:
                    link.request_beep(kind="person", duration_ms=120)
                    last_beep_time = now
            elif obstacle_close:
                print(f"進行方向に障害物: {obstacle_label} ({distance_cm:.0f}cm)")
                if can_beep:
                    link.request_beep(kind="obstacle", duration_ms=120)
                    last_beep_time = now
            elif unclassified_close:
                print(f"進行方向に障害物 ({distance_cm:.0f}cm) ※種類は未判定")
                if can_beep:
                    link.request_beep(kind="obstacle", duration_ms=120)
                    last_beep_time = now

            cv2.imshow("obstacle detection", results.plot())
            if cv2.waitKey(1) == ord("q"):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()
        link.close()


if __name__ == "__main__":
    main()