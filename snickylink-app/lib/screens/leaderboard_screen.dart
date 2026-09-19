import 'package:flutter/material.dart';
import '../backend.dart';
import '../theme.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key, required this.revision});
  final int revision;

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = Backend.leaderboard();
  }

  @override
  void didUpdateWidget(covariant LeaderboardScreen old) {
    super.didUpdateWidget(old);
    if (old.revision != widget.revision) {
      setState(() => _future = Backend.leaderboard());
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = dark ? Brand.peach : Brand.wine;

    return RefreshIndicator(
      onRefresh: () async => setState(() => _future = Backend.leaderboard()),
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(children: [
              const SizedBox(height: 80),
              Center(child: Text(friendlyError(snap.error!)))
            ]);
          }

          final entries = (snap.data?['entries'] as List?) ?? const [];
          if (entries.isEmpty) {
            return ListView(children: const [
              SizedBox(height: 80),
              Center(child: Text('Abhi koi ranking nahi hai.')),
            ]);
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: entries.length,
            itemBuilder: (context, i) {
              final e = Map<String, dynamic>.from(entries[i] as Map);
              final isMe = e['isMe'] == true;
              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                color: isMe ? accent.withOpacity(0.12) : null,
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: accent,
                    child: Text('${e['rank'] ?? '-'}',
                        style: TextStyle(
                            color: dark ? Brand.wineBlack : Colors.white,
                            fontWeight: FontWeight.bold)),
                  ),
                  title: Text(isMe ? 'Tum dono' : 'Couple #${e['rank']}',
                      style: TextStyle(
                          fontWeight:
                              isMe ? FontWeight.bold : FontWeight.normal)),
                  subtitle: Text(
                      '${e['completed'] ?? 0} Snicks · ${e['streak'] ?? 0} day streak'),
                  trailing: Text('${e['xp'] ?? 0} XP',
                      style: TextStyle(
                          fontWeight: FontWeight.bold, color: accent)),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
