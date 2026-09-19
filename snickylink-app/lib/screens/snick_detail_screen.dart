import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../backend.dart';
import '../theme.dart';

class SnickDetailScreen extends StatefulWidget {
  const SnickDetailScreen({
    super.key,
    required this.snickId,
    required this.coupleId,
  });
  final String snickId;
  final String coupleId;

  @override
  State<SnickDetailScreen> createState() => _SnickDetailScreenState();
}

class _SnickDetailScreenState extends State<SnickDetailScreen> {
  final _text = TextEditingController();
  late Future<Map<String, dynamic>> _future;
  XFile? _picked;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = Backend.snickDetail(widget.snickId);
  }

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _pickPhoto() async {
    final file = await ImagePicker()
        .pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (file != null && mounted) setState(() => _picked = file);
  }

  Future<void> _submit(String verification) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      String? mediaId;
      if (verification == 'photo') {
        if (_picked == null) {
          throw Exception('media_required');
        }
        final bytes = await _picked!.readAsBytes();
        final ext = _picked!.name.split('.').last.toLowerCase();
        mediaId = await Backend.uploadMedia(
          coupleId: widget.coupleId,
          bytes: bytes,
          extension: ext.isEmpty ? 'jpg' : ext,
          mime: ext == 'png' ? 'image/png' : 'image/jpeg',
        );
      }

      final res = await Backend.submitSnick(
        widget.snickId,
        text: verification == 'photo' ? null : _text.text.trim(),
        mediaId: mediaId,
      );

      if (!mounted) return;
      final status = res['status'] as String?;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(status == 'AWAITING_PARTNER'
              ? 'Bhej diya. Ab partner confirm karega.'
              : 'Snick complete. XP mil gaya!'),
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('Snick')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text(friendlyError(snap.error!)));
          }

          final s = snap.data ?? const <String, dynamic>{};
          final verification = s['verification'] as String? ?? 'text';
          final submission = s['submission'] as Map?;
          final alreadyDone = s['state'] == 'VERIFIED';
          final awaitingPartner = submission != null &&
              submission['status'] == 'AWAITING_PARTNER';
          // The backend decides who may confirm; never re-derive this locally.
          final canConfirm = submission != null && submission['canConfirm'] == true;
          final mine = submission != null && submission['isMine'] == true;

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(s['title'] as String? ?? '',
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              Text(s['prompt'] as String? ?? '',
                  style: Theme.of(context).textTheme.bodyLarge),
              const SizedBox(height: 18),
              Row(children: [
                Text('+${s['xp'] ?? 0} XP',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: dark ? Brand.peach : Brand.wine)),
                const SizedBox(width: 12),
                if (s['category'] != null) Text(s['category'] as String),
              ]),
              const Divider(height: 36),

              if (alreadyDone)
                const Text('Ye Snick complete ho chuka hai.')
              else if (awaitingPartner && mine)
                const Text('Bhej diya. Ab partner ke confirm ka wait hai.')
              else if (awaitingPartner && canConfirm) ...[
                const Text('Partner ne ye Snick complete kiya hai. Confirm karo?'),
                const SizedBox(height: 14),
                FilledButton(
                  onPressed: _busy
                      ? null
                      : () async {
                          setState(() => _busy = true);
                          try {
                            await Backend.confirmPartner(
                                submission['id'] as String);
                            if (mounted) Navigator.of(context).pop();
                          } catch (e) {
                            if (mounted) {
                              setState(() => _error = friendlyError(e));
                            }
                          } finally {
                            if (mounted) setState(() => _busy = false);
                          }
                        },
                  child: const Text('Haan, ye hua tha'),
                ),
              ] else ...[
                if (verification == 'photo') ...[
                  OutlinedButton.icon(
                    onPressed: _busy ? null : _pickPhoto,
                    icon: const Icon(Icons.photo_camera_outlined),
                    label: Text(_picked == null
                        ? 'Photo chuno'
                        : 'Photo chuni: ${_picked!.name}'),
                  ),
                ] else ...[
                  TextField(
                    controller: _text,
                    maxLines: 5,
                    decoration: InputDecoration(
                      labelText: verification == 'partner'
                          ? 'Kya kiya? (optional)'
                          : 'Tumhara jawab',
                      alignLabelWithHint: true,
                    ),
                  ),
                ],
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: _busy ? null : () => _submit(verification),
                  child: _busy
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Submit karo'),
                ),
              ],

              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Text(_error!,
                      style: const TextStyle(color: Colors.redAccent)),
                ),
            ],
          );
        },
      ),
    );
  }
}
