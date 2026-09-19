import 'package:flutter/material.dart';
import '../backend.dart';
import '../theme.dart';

class StatsScreen extends StatefulWidget {
  const StatsScreen({super.key, required this.revision});
  final int revision;

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = Backend.stats();
  }

  @override
  void didUpdateWidget(covariant StatsScreen old) {
    super.didUpdateWidget(old);
    if (old.revision != widget.revision) {
      setState(() => _future = Backend.stats());
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final accent = dark ? Brand.peach : Brand.wine;

    return RefreshIndicator(
      onRefresh: () async => setState(() => _future = Backend.stats()),
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

          final d = snap.data ?? const <String, dynamic>{};
          final level = (d['level'] as Map?) ?? const {};
          final totalXp = (d['totalXp'] as num?)?.toInt() ?? 0;
          final nextAt = (level['nextAt'] as num?)?.toInt();
          final categories = (d['categories'] as List?) ?? const [];

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(level['name'] as String? ?? 'Level',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: accent)),
                      const SizedBox(height: 4),
                      Text('$totalXp XP'),
                      if (nextAt != null) ...[
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(999),
                          child: LinearProgressIndicator(
                            value: nextAt == 0
                                ? 0
                                : (totalXp / nextAt).clamp(0.0, 1.0),
                            minHeight: 10,
                            color: accent,
                            backgroundColor: accent.withOpacity(0.15),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text('Agle level tak ${nextAt - totalXp} XP',
                            style: const TextStyle(fontSize: 12)),
                      ],
                    ],
                  ),
                ),
              ),
              Row(children: [
                Expanded(
                    child: _Stat(
                        label: 'Current streak',
                        value: '${d['currentStreak'] ?? 0}')),
                Expanded(
                    child: _Stat(
                        label: 'Longest streak',
                        value: '${d['longestStreak'] ?? 0}')),
              ]),
              Row(children: [
                Expanded(
                    child: _Stat(
                        label: 'Snicks done',
                        value: '${d['snicksCompleted'] ?? 0}')),
                Expanded(
                    child: _Stat(
                        label: 'Completion',
                        value: '${d['completionRate'] ?? 0}%')),
              ]),
              if (categories.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Categories',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                ...categories.map((raw) {
                  final c = Map<String, dynamic>.from(raw as Map);
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    title: Text(c['category'] as String? ?? ''),
                    trailing: Text('${c['completed'] ?? 0}'),
                  );
                }),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 14),
        child: Column(children: [
          Text(value,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12)),
        ]),
      ),
    );
  }
}
