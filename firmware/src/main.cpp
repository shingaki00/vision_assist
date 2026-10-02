#include <M5StickCPlus2.h>

// ===== 超音波センサー (HC-SR04) の設定 =====
// 配線:
//   HC-SR04 VCC  -> 5V
//   HC-SR04 GND  -> GND
//   HC-SR04 TRIG -> G0
//   HC-SR04 ECHO -> G36 (分圧抵抗 or 1kΩ経由で接続)
const int TRIG_PIN = 0;   // G0
const int ECHO_PIN = 36;  // G36

// PC(YOLO判定)を介さずに単体でも鳴る、最低限の安全用しきい値(cm)
const float LOCAL_SAFETY_DISTANCE_CM = 15.0f;

// PCから送られてくるコマンドの受信バッファ
String serialBuffer = "";

// HC-SR04で距離を計測する(cm)。反射が無い場合は-1を返す
float measureDistanceCm() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    if (duration == 0) {
        return -1.0f;
    }
    return duration * 0.0343f / 2.0f;
}

// PCから以下の形式でビープ要求が来たら鳴らす
//   "BO:<ミリ秒>\n" -> 障害物用(低めの音)
//   "BP:<ミリ秒>\n" -> 人間用(高めの音、区別しやすくするため)
void handleIncomingCommands() {
    while (Serial.available() > 0) {
        char c = Serial.read();
        if (c == '\n') {
            if (serialBuffer.startsWith("BO:")) {
                int durationMs = serialBuffer.substring(3).toInt();
                if (durationMs > 0) {
                    StickCP2.Speaker.tone(2000, durationMs); // 障害物用
                    StickCP2.Display.fillScreen(RED);
                }
            } else if (serialBuffer.startsWith("BP:")) {
                int durationMs = serialBuffer.substring(3).toInt();
                if (durationMs > 0) {
                    StickCP2.Speaker.tone(3500, durationMs); // 人間用(高め)
                    StickCP2.Display.fillScreen(ORANGE);
                }
            }
            serialBuffer = "";
        } else {
            serialBuffer += c;
            // 異常に長い入力が来た場合の保険(通常はここまで伸びない)
            if (serialBuffer.length() > 32) {
                serialBuffer = "";
            }
        }
    }
}

void setup() {
    auto cfg = M5.config();
    StickCP2.begin(cfg);

    Serial.begin(115200);

    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    digitalWrite(TRIG_PIN, LOW);

    StickCP2.Display.setBrightness(255);
    StickCP2.Display.fillScreen(GREEN);
}

void loop() {
    float distance = measureDistanceCm();

    // 1. 距離をPCへ送信する(PC側はこれを読んでYOLOの判定結果と組み合わせる)
    Serial.print("D:");
    Serial.println(distance, 1);

    // 2. PCからのビープ要求があれば処理する
    handleIncomingCommands();

    // 3. PC側が動いていなくても効く、最低限の安全装置(近すぎる場合は単体でも鳴る)
    if (distance > 0 && distance < LOCAL_SAFETY_DISTANCE_CM) {
        StickCP2.Speaker.tone(2500, 80);
        StickCP2.Display.fillScreen(RED);
    } else {
        StickCP2.Display.fillScreen(GREEN);
    }

    delay(100);
}