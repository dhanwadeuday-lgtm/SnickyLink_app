import 'package:flutter/material.dart';

/// SnickyLink "Wine & Peach" palette.
class Brand {
  static const wine       = Color(0xFF6B2B3C); // primary, CTAs, brand mark
  static const wineBlack  = Color(0xFF3A1620); // secondary, night surfaces
  static const peach      = Color(0xFFE8B99C); // accent, highlights, reveals
  static const blushWhite = Color(0xFFFBF4F1); // day background
  static const inkWine    = Color(0xFF1E0E13); // night background
}

ThemeData buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;

  final scheme = isDark
      ? const ColorScheme.dark(
          primary: Brand.peach,
          onPrimary: Brand.wineBlack,
          secondary: Brand.wine,
          surface: Brand.wineBlack,
          onSurface: Color(0xFFF3E7E2),
        )
      : const ColorScheme.light(
          primary: Brand.wine,
          onPrimary: Colors.white,
          secondary: Brand.peach,
          surface: Colors.white,
          onSurface: Brand.inkWine,
        );

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: isDark ? Brand.inkWine : Brand.blushWhite,
    appBarTheme: AppBarTheme(
      backgroundColor: isDark ? Brand.inkWine : Brand.blushWhite,
      foregroundColor: isDark ? Brand.peach : Brand.wine,
      elevation: 0,
      centerTitle: false,
    ),
    // Card styling is applied per-widget rather than through cardTheme:
    // that property changed type (CardTheme -> CardThemeData) between Flutter
    // versions, and hardcoding either one breaks the build on the other.
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark ? Brand.wineBlack : Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
    ),
  );
}
