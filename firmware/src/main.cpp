#include <M5StickCPlus2.h>

void setup() {
    auto cfg = M5.config();
    StickCP2.begin(cfg);

    // バックライトを最大輝度で点灯
    StickCP2.Display.setBrightness(255);
    // 画面を「緑色」に塗りつぶす（一番目立つ色です）
    StickCP2.Display.fillScreen(GREEN);
}

void loop() {
    // 動作確認：本体のLEDを高速点滅させる
    StickCP2.Power.setLed(true);
    delay(100);
    StickCP2.Power.setLed(false);
    delay(100);
}