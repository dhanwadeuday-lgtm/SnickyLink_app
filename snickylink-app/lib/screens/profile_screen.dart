import 'package:flutter/material.dart';
import '../backend.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key, required this.status});
  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    final members = (status['members'] as List?) ?? const [];
    final partner = status['partner'] as Map?;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Couple',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                ...members.map((raw) {
                  final m = Map<String, dynamic>.from(raw as Map);
                  final isPartner = partner != null && m['id'] == partner['id'];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(child: Icon(Icons.person)),
                    title: Text(m['name'] as String? ?? ''),
                    subtitle: Text(m['email'] as String? ?? ''),
                    trailing: Text(isPartner ? 'Partner' : 'Tum',
                        style: const TextStyle(fontSize: 12)),
                  );
                }),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () => Backend.auth.signOut(),
          icon: const Icon(Icons.logout),
          label: const Text('Sign out'),
        ),
      ],
    );
  }
}
