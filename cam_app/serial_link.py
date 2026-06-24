"""
M5StickC Plus2とのシリアル通信を扱うモジュール。

M5StickC Plus2は "D:<距離cm>\n" を継続的に送ってくるので、
バックグラウンドスレッドで読み続け、常に最新の距離を取得できるようにする。
ビープを鳴らしたいときは "B:<ミリ秒>\n" を送る。
"""

import threading
import time

import serial


class UltrasonicLink:
    def __init__(self, port: str, baudrate: int = 115200, timeout: float = 1.0):
        self.ser = serial.Serial(port, baudrate, timeout=timeout)
        self.latest_distance_cm = None
        self._lock = threading.Lock()
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()
        time.sleep(2)  # M5Stick起動・シリアル安定待ち

    def _read_loop(self):
        while self._running:
            try:
                raw = self.ser.readline()
            except Exception:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if not line.startswith("D:"):
                continue
            try:
                value = float(line[2:])
            except ValueError:
                continue
            with self._lock:
                self.latest_distance_cm = value if value > 0 else None

    def get_distance_cm(self):
        """最新の距離(cm)を返す。反射が無い/未受信の場合はNone"""
        with self._lock:
            return self.latest_distance_cm

    def request_beep(self, kind: str = "obstacle", duration_ms: int = 120):
        """kind: "obstacle"(障害物用) または "person"(人間用)"""
        prefix = "BP" if kind == "person" else "BO"
        try:
            self.ser.write(f"{prefix}:{duration_ms}\n".encode("utf-8"))
        except Exception as e:
            print(f"ビープ要求の送信に失敗しました: {e}")

    def close(self):
        self._running = False
        self._thread.join(timeout=1.0)
        self.ser.close()