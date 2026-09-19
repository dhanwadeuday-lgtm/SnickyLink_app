import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'backend.dart';
import 'theme.dart';
import 'screens/auth_screen.dart';
import 'screens/pair_screen.dart';
import 'screens/home_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Backend.init();
  runApp(const SnickyApp());
}

class SnickyApp extends StatelessWidget {
  const SnickyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SnickyLink',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(Brightness.light),
      darkTheme: buildTheme(Brightness.dark),
      home: const AuthGate(),
    );
  }
}

/// Decides between sign-in, pairing and the main app, and re-checks whenever
/// the auth session changes.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  Session? _session;

  @override
  void initState() {
    super.initState();
    _session = Backend.auth.currentSession;
    Backend.auth.onAuthStateChange.listen((event) {
      if (mounted) setState(() => _session = event.session);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_session == null) return const AuthScreen();
    return const CoupleGate();
  }
}

/// A signed-in user still needs an ACTIVE couple before the app is usable.
class CoupleGate extends StatefulWidget {
  const CoupleGate({super.key});

  @override
  State<CoupleGate> createState() => _CoupleGateState();
}

class _CoupleGateState extends State<CoupleGate> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = Backend.coupleStatus();
  }

  void _reload() => setState(() => _future = Backend.coupleStatus());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        if (snap.hasError) {
          return Scaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(friendlyError(snap.error!),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _reload, child: const Text('Retry')),
                    TextButton(
                      onPressed: () => Backend.auth.signOut(),
                      child: const Text('Sign out'),
                    ),
                  ],
                ),
              ),
            ),
          );
        }

        final data = snap.data ?? const {};
        final state = data['state'] as String?;
        final coupleId = data['coupleId'] as String?;

        if (state == 'ACTIVE' && coupleId != null) {
          return HomeShell(coupleId: coupleId, status: data);
        }
        return PairScreen(onPaired: _reload);
      },
    );
  }
}
