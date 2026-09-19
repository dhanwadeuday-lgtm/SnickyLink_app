import 'package:flutter/material.dart';
import '../backend.dart';
import '../theme.dart';
import 'snick_detail_screen.dart';

class SnicksScreen extends StatefulWidget {
  const SnicksScreen({super.key, required this.coupleId, required this.revision});
  final String coupleId;
  final int revision;

  @override
  State<SnicksScreen> createState() => _SnicksScreenState();
}

class _SnicksScreenState extends State<SnicksScreen> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = Backend.dailySnicks();
  }

  @override
  void didUpdateWidget(covariant SnicksScreen old) {
    super.didUpdateWidget(old);
    if (old.revision != widget.revision) _reload();
  }

  void _reload() => setState(() => _future = Backend.dailySnicks());

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => _reload(),
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ListView(children: [
              const SizedBox(height: 80),
              Center(child: Text(friendlyError(snap.error!))),
            ]);
          }

          final snicks = (snap.data?['snicks'] as List?) ?? const [];
          final done = snicks
              .where((s) => (s as Map)['state'] == 'VERIFIED')
              .length;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _ProgressHeader(done: done, total: snicks.length),
              const SizedBox(height: 8),
              ...snicks.map((raw) {
                final s = Map<String, dynamic>.from(raw as Map);
                return _SnickCard(
                  snick: s,
                  coupleId: widget.coupleId,
                  onChanged: _reload,
                );
              }),
              const SizedBox(height: 24),
            ],
          );
        },
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({required this.done, required this.total});
  final int done;
  final int total;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: List.generate(total, (i) {
            final filled = i < done;
            return Container(
              width: 18,
              height: 18,
              margin: const EdgeInsets.only(right: 8),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: filled
                    ? (dark ? Brand.peach : Brand.wine)
                    : (dark ? Colors.white24 : Colors.black12),
              ),
            );
          }),
        ),
        const SizedBox(height: 10),
        Text('Aaj ka progress: $done of $total',
            style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _SnickCard extends StatelessWidget {
  const _SnickCard({
    required this.snick,
    required this.coupleId,
    required this.onChanged,
  });

  final Map<String, dynamic> snick;
  final String coupleId;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final state = snick['state'] as String? ?? 'LOCKED';
    final isMystery = snick['isMystery'] == true;
    final locked = snick['locked'] == true;
    final openable = state == 'ACTIVE';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: openable
            ? () async {
                await Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => SnickDetailScreen(
                    snickId: snick['id'] as String,
                    coupleId: coupleId,
                  ),
                ));
                onChanged();
              }
            : null,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    'SNICK #${((snick['slot'] as num?)?.toInt() ?? 0) + 1}',
                    style: TextStyle(
                      fontSize: 11,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.bold,
                      color: dark ? Brand.peach : Brand.wine,
                    ),
                  ),
                  const Spacer(),
                  _StateChip(state: state, isMystery: isMystery && locked),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                snick['title'] as String? ?? '',
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Text(snick['prompt'] as String? ?? '',
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (snick['category'] != null)
                    _Pill(text: snick['category'] as String),
                  if (snick['verification'] != null) ...[
                    const SizedBox(width: 6),
                    _Pill(text: _verificationLabel(snick['verification'] as String)),
                  ],
                  const Spacer(),
                  Text('+${snick['xp'] ?? 0} XP',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: dark ? Brand.peach : Brand.wine,
                      )),
                ],
              ),
              if (openable) ...[
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: () async {
                    await Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => SnickDetailScreen(
                        snickId: snick['id'] as String,
                        coupleId: coupleId,
                      ),
                    ));
                    onChanged();
                  },
                  child: const Text('Answer Snick'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  static String _verificationLabel(String v) {
    switch (v) {
      case 'photo':
        return 'Photo';
      case 'partner':
        return 'Partner confirm';
      default:
        return 'Text';
    }
  }
}

class _StateChip extends StatelessWidget {
  const _StateChip({required this.state, required this.isMystery});
  final String state;
  final bool isMystery;

  @override
  Widget build(BuildContext context) {
    late String label;
    late Color color;
    if (isMystery) {
      label = 'Mystery';
      color = Brand.peach;
    } else {
      switch (state) {
        case 'ACTIVE':
          label = 'Abhi karo';
          color = Brand.wine;
          break;
        case 'VERIFIED':
          label = 'Done';
          color = Colors.green;
          break;
        case 'SUBMITTED':
          label = 'Partner ka wait';
          color = Colors.orange;
          break;
        case 'EXPIRED':
          label = 'Miss ho gaya';
          color = Colors.grey;
          break;
        default:
          label = 'Locked';
          color = Colors.grey;
      }
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: 11, fontWeight: FontWeight.bold, color: color)),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.withOpacity(0.4)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11)),
    );
  }
}
