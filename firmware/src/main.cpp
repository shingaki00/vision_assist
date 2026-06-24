#include <M5StickCPlus2.h>

// ===== 超音波センサー (HC-SR04) の設定 =====
// 配線:
//   HC-SR04 VCC  -> 5V
//   HC-SR04 GND  -> GND
//   HC-SR04 TRIG -> G0
//   HC-SR04 ECHO -> G36 （※下の注意を必ず読んでください）
//
// 注意: HC-SR04のECHO出力は5Vですが、M5StickC Plus2のGPIOは3.3V対応です。
// 直結すると基板を傷める恐れがあるため、ECHOとG36の間に分圧抵抗を入れて
// 3.3V程度まで下げてください（例: ECHO --[1kΩ]-- G36 --[2kΩ]-- GND）。
const int TRIG_PIN = 0;   // G0
const int ECHO_PIN = 36;  // G36

// 物体検知のしきい値（この距離[cm]より近いと音を鳴らす）
// HC-SR04の仕様上の検知範囲は2cm~400cm程度なので、1m(100cm)は問題なく検知できる
const float DETECT_DISTANCE_CM = 100.0f;

// HC-SR04で距離を計測する（cm）。反射が無い/範囲外の場合は-1を返す
float measureDistanceCm() {
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(2);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);

    // 反射が30ms（約5m相当）以内に来なければタイムアウトで0が返る
    unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000);
    if (duration == 0) {
        return -1.0f;
    }
    // 距離(cm) = 経過時間(us) × 音速(約0.0343cm/us) ÷ 2（往復分なので2で割る）
    return duration * 0.0343f / 2.0f;
}

void setup() {
    auto cfg = M5.config();
    StickCP2.begin(cfg);

    pinMode(TRIG_PIN, OUTPUT);
    pinMode(ECHO_PIN, INPUT);
    digitalWrite(TRIG_PIN, LOW);

    // バックライトを最大輝度で点灯
    StickCP2.Display.setBrightness(255);
    // 画面を「緑色」に塗りつぶす（一番目立つ色です）
    StickCP2.Display.fillScreen(GREEN);
     Serial.print("  -> distance(cm): ");
}

void loop() {
    float distance = measureDistanceCm();

    if (distance > 0 && distance < DETECT_DISTANCE_CM) {
        // 物体を検知 -> 画面を赤くしてブザーを鳴らす
        StickCP2.Display.fillScreen(RED);
        StickCP2.Speaker.tone(2000, 100); // 2000Hzの音を100ms再生
         Serial.print("  -> distance(cm): ");
    } else {
        // 物体なし -> 画面を緑に戻す
        StickCP2.Display.fillScreen(GREEN);
    }

    // 動作確認：本体のLEDを高速点滅させる
    StickCP2.Power.setLed(true);
    delay(100);
    StickCP2.Power.setLed(false);
    delay(100);
}
