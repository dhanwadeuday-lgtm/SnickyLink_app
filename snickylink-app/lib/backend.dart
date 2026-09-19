import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Thin wrapper over the SnickyLink backend.
///
/// The client never writes tables directly. Every engine is a Postgres RPC
/// guarded by Row Level Security and auth.uid(), so the server stays
/// authoritative: XP, verification and couple isolation cannot be forged
/// from here.
class Backend {
  static const String url = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://fwaslanxcoyplpmpfcdn.supabase.co',
  );
  static const String publishableKey = String.fromEnvironment(
    'SUPABASE_KEY',
    defaultValue: 'sb_publishable_h3R7KLIseiONpWwQ6RTrkQ_r3rLD-_H',
  );

  static Future<void> init() async {
    await Supabase.initialize(url: url, anonKey: publishableKey);
  }

  static SupabaseClient get client => Supabase.instance.client;
  static GoTrueClient get auth => client.auth;
  static String? get userId => auth.currentUser?.id;

  static Future<dynamic> _rpc(String fn, [Map<String, dynamic>? params]) async {
    return await client.rpc(fn, params: params ?? const {});
  }

  // ---------- Identity & Couple ----------
  static Future<Map<String, dynamic>> me() async =>
      Map<String, dynamic>.from(await _rpc('me'));

  static Future<Map<String, dynamic>> coupleStatus() async =>
      Map<String, dynamic>.from(await _rpc('couple_status'));

  static Future<Map<String, dynamic>> createInvite({int tzOffsetMinutes = 330}) async =>
      Map<String, dynamic>.from(
          await _rpc('couple_invite', {'p_tz_offset': tzOffsetMinutes}));

  static Future<Map<String, dynamic>> joinCouple(String code) async =>
      Map<String, dynamic>.from(
          await _rpc('couple_join', {'p_code': code.trim().toUpperCase()}));

  // ---------- Snick engine ----------
  static Future<Map<String, dynamic>> dailySnicks() async =>
      Map<String, dynamic>.from(await _rpc('daily_snicks_list'));

  static Future<Map<String, dynamic>> snickDetail(String snickId) async =>
      Map<String, dynamic>.from(
          await _rpc('snick_detail', {'p_snick_id': snickId}));

  static Future<Map<String, dynamic>> submitSnick(
    String snickId, {
    String? text,
    String? mediaId,
  }) async =>
      Map<String, dynamic>.from(await _rpc('snick_submit', {
        'p_snick_id': snickId,
        'p_text': text,
        'p_media_id': mediaId,
      }));

  static Future<Map<String, dynamic>> confirmPartner(String submissionId) async =>
      Map<String, dynamic>.from(
          await _rpc('snick_confirm', {'p_submission_id': submissionId}));

  // ---------- Progress ----------
  static Future<Map<String, dynamic>> stats() async =>
      Map<String, dynamic>.from(await _rpc('stats_for_couple'));

  static Future<Map<String, dynamic>> leaderboard() async =>
      Map<String, dynamic>.from(await _rpc('leaderboard_list'));

  static Future<Map<String, dynamic>> notifications() async =>
      Map<String, dynamic>.from(await _rpc('notifications_list'));

  static Future<void> markNotificationsRead() async =>
      await _rpc('notifications_mark_read');

  // ---------- Memories / Calendar / Community ----------
  static Future<Map<String, dynamic>> memories() async =>
      Map<String, dynamic>.from(await _rpc('memories_list'));

  static Future<Map<String, dynamic>> calendar() async =>
      Map<String, dynamic>.from(await _rpc('calendar_list'));

  static Future<Map<String, dynamic>> communityFeed() async =>
      Map<String, dynamic>.from(await _rpc('community_feed'));

  // ---------- Media ----------
  /// Uploads to the private `media` bucket and registers it.
  ///
  /// The storage policy requires the first path segment to be the couple id,
  /// and media_register re-checks it, so a user cannot write into another
  /// couple's folder.
  static Future<String> uploadMedia({
    required String coupleId,
    required Uint8List bytes,
    required String extension,
    required String mime,
  }) async {
    final path =
        '$coupleId/${DateTime.now().millisecondsSinceEpoch}.$extension';
    await client.storage.from('media').uploadBinary(
          path,
          bytes,
          fileOptions: FileOptions(contentType: mime, upsert: false),
        );
    final mediaId = await _rpc('media_register', {
      'p_path': path,
      'p_mime': mime,
    });
    return mediaId as String;
  }

  static Future<String> signedUrl(String path, {int seconds = 3600}) =>
      client.storage.from('media').createSignedUrl(path, seconds);

  // ---------- Realtime ----------
  static RealtimeChannel subscribeCouple(
    String coupleId,
    void Function(String table) onChange,
  ) {
    return client
        .channel('couple:$coupleId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'daily_snicks',
          callback: (_) => onChange('daily_snicks'),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notifications',
          callback: (_) => onChange('notifications'),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'messages',
          callback: (_) => onChange('messages'),
        )
        .subscribe();
  }
}

/// Turns backend error codes into something a person can read.
String friendlyError(Object e) {
  final raw = e is PostgrestException ? e.message : e.toString();
  const map = {
    'no_active_couple': 'Pehle apne partner ke saath pair karo.',
    'already_paired': 'Tum pehle se paired ho.',
    'invalid_code': 'Ye invite code galat ya expire ho chuka hai.',
    'window_not_active': 'Is Snick ka 2-ghante ka window abhi active nahi hai.',
    'media_required': 'Is Snick ke liye photo zaroori hai.',
    'text_required': 'Thoda aur likho (kam se kam 3 characters).',
    'cannot_confirm_own': 'Apna hi Snick confirm nahi kar sakte.',
    'not_found': 'Ye Snick nahi mila.',
    'forbidden': 'Iski permission nahi hai.',
    'admin_only': 'Sirf admin ye kar sakta hai.',
  };
  for (final entry in map.entries) {
    if (raw.contains(entry.key)) return entry.value;
  }
  return raw;
}
