import React from 'react';
import { Text, TextInput, Pressable, View, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from './theme';

export const Screen = ({ children, style }: any) => (
  <View style={[s.screen, style]}>{children}</View>
);

export const H1 = ({ children }: any) => <Text style={s.h1}>{children}</Text>;
export const P = ({ children, style }: any) => <Text style={[s.p, style]}>{children}</Text>;

export const Field = (props: any) => (
  <TextInput
    {...props}
    placeholderTextColor={theme.muted}
    style={[s.field, props.style]}
  />
);

export const Button = ({ title, onPress, loading, variant = 'solid', disabled }: any) => (
  <Pressable
    onPress={onPress}
    disabled={loading || disabled}
    style={({ pressed }) => [
      s.btn,
      variant === 'ghost' && s.btnGhost,
      (pressed || loading || disabled) && { opacity: 0.6 },
    ]}
  >
    {loading ? (
      <ActivityIndicator color={variant === 'ghost' ? theme.peach : theme.wineDark} />
    ) : (
      <Text style={[s.btnText, variant === 'ghost' && { color: theme.peach }]}>{title}</Text>
    )}
  </Pressable>
);

export const Err = ({ children }: any) =>
  children ? <Text style={s.err}>{String(children)}</Text> : null;

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 24 },
  h1: { color: theme.text, fontSize: 30, fontWeight: '700', marginBottom: 8 },
  p: { color: theme.muted, fontSize: 15, lineHeight: 22 },
  field: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 16,
    marginTop: 12,
  },
  btn: {
    backgroundColor: theme.peach,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.line },
  btnText: { color: theme.wineDark, fontWeight: '700', fontSize: 16 },
  err: { color: '#E98B7A', marginTop: 12, fontSize: 14 },
});
