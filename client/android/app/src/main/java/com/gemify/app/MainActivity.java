package com.gemify.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int GEMIFY_SYSTEM_BAR_COLOR = Color.rgb(11, 16, 38);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyGemifySystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        applyGemifySystemBars();
    }

    private void applyGemifySystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(GEMIFY_SYSTEM_BAR_COLOR);
        getWindow().setNavigationBarColor(GEMIFY_SYSTEM_BAR_COLOR);

        WindowInsetsControllerCompat insetsController =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);
    }
}
