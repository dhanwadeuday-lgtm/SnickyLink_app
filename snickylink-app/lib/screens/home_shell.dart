import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../backend.dart';
import 'snicks_screen.dart';
import 'stats_screen.dart';
import 'leaderboard_screen.dart';
import 'profile_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.coupleId, required this.status});
  final String coupleId;
  final Map<String, dynamic> status;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  RealtimeChannel? _channel;

  /// Bumped whenever the backend pushes a change, so child screens can
  /// refetch instead of polling.
  int _revision = 0;

  @override
  void initState() {
    super.initState();
    _channel = Backend.subscribeCouple(widget.coupleId, (_) {
      if (mounted) setState(() => _revision++);
    });
  }

  @override
  void dispose() {
    if (_channel != null) Backend.client.removeChannel(_channel!);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final partner = widget.status['partner'] as Map<String, dynamic>?;

    final pages = [
      SnicksScreen(coupleId: widget.coupleId, revision: _revision),
      StatsScreen(revision: _revision),
      LeaderboardScreen(revision: _revision),
      ProfileScreen(status: widget.status),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(_index == 0 && partner != null
            ? 'Tum aur ${partner['name']}'
            : const ['Aaj ke Snicks', 'Progress', 'Leaderboard', 'Profile'][_index]),
      ),
      body: pages[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.favorite_outline),
              selectedIcon: Icon(Icons.favorite),
              label: 'Snicks'),
          NavigationDestination(
              icon: Icon(Icons.insights_outlined),
              selectedIcon: Icon(Icons.insights),
              label: 'Progress'),
          NavigationDestination(
              icon: Icon(Icons.emoji_events_outlined),
              selectedIcon: Icon(Icons.emoji_events),
              label: 'Ranking'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'Profile'),
        ],
      ),
    );
  }
}
