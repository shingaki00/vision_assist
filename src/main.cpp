#include <M5Unified.h>

void setup() {
    auto cfg = M5.config();
    M5.begin(cfg);

    // 画面の初期設定
    M5.Lcd.setRotation(1);       // 横向き
    M5.Lcd.setBrightness(100);   // 明るさ (0-255)
    M5.Lcd.fillScreen(BLACK);
    
    M5.Lcd.setFont(&fonts::FreeSansBold12pt7b);
    M5.Lcd.setTextColor(PURPLE); // お好みの紫色で表示
    M5.Lcd.setCursor(10, 30);
    M5.Lcd.println("M5StickC Plus2");
    M5.Lcd.setCursor(10, 60);
    M5.Lcd.setTextColor(WHITE);
    M5.Lcd.println("Check System...");
}

void loop() {
    M5.update(); // ボタン状態の更新に必須

    // ボタンA（正面の大きなボタン）を押した時
    if (M5.BtnA.wasPressed()) {
        M5.Lcd.fillScreen(BLUE);
        M5.Lcd.setCursor(10, 90);
        M5.Lcd.println("Button A Pressed!");
        M5.Speaker.tone(440, 100); // ピーと鳴らす
    }

    // ボタンB（側面のボタン）を押した時
    if (M5.BtnB.wasPressed()) {
        M5.Lcd.fillScreen(ORANGE);
        M5.Lcd.setCursor(10, 90);
        M5.Lcd.println("Button B Pressed!");
        M5.Speaker.tone(880, 100); // 高い音を鳴らす
    }

    // バッテリー残量を表示（リアルタイム更新）
    int battery = M5.Power.getBatteryLevel();
    M5.Lcd.setCursor(10, 120);
    M5.Lcd.printf("Battery: %d%%  ", battery);

    delay(10);
}