import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../backend.dart';
import '../theme.dart';

class PairScreen extends StatefulWidget {
  const PairScreen({super.key, required this.onPaired});
  final VoidCallback onPaired;

  @override
  State<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends State<PairScreen> {
  final _code = TextEditingController();
  String? _myCode;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Partner ke saath jodo'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => Backend.auth.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'SnickyLink do logon ke liye hai. Ek invite code banao aur partner ko bhejo, '
            'ya unka code yahan daalo.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Invite bhejo',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  if (_myCode != null) ...[
                    SelectableText(
                      _myCode!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 32,
                        letterSpacing: 6,
                        fontWeight: FontWeight.bold,
                        color: Brand.wine,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text('7 din me expire ho jaayega',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12)),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: _myCode!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Code copy ho gaya')),
                        );
                      },
                      icon: const Icon(Icons.copy),
                      label: const Text('Copy karo'),
                    ),
                  ] else
                    FilledButton(
                      onPressed: _busy
                          ? null
                          : () => _run(() async {
                                final res = await Backend.createInvite(
                                  tzOffsetMinutes:
                                      DateTime.now().timeZoneOffset.inMinutes,
                                );
                                setState(() => _myCode = res['code'] as String?);
                              }),
                      child: const Text('Invite code banao'),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Code se join karo',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _code,
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 8,
                    decoration: const InputDecoration(
                      labelText: 'Partner ka 8-digit code',
                      counterText: '',
                    ),
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _busy
                        ? null
                        : () => _run(() async {
                              await Backend.joinCouple(_code.text);
                              widget.onPaired();
                            }),
                    child: const Text('Join karo'),
                  ),
                ],
              ),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.redAccent)),
            ),
          const SizedBox(height: 12),
          Center(
            child: TextButton(
              onPressed: widget.onPaired,
              child: const Text('Status refresh karo'),
            ),
          ),
        ],
      ),
    );
  }
}
