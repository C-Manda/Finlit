import { CompactProgress } from './data-charts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname, useRouter } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';

import { radii, spacing, usePalette, useCommonStyles, themedStyles } from '@/constants/finlit-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Tone = 'blush' | 'mint' | 'blue' | 'peach' | 'lilac';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const commonStyles = useCommonStyles();

  const body = scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={commonStyles.content} showsVerticalScrollIndicator={false}>{children}</ScrollView> : children;
  return <SafeAreaView style={commonStyles.page}>{body}</SafeAreaView>;
}

export function Header({ title, back = false, action }: { title: string; back?: boolean; action?: ReactNode }) {
  const styles = useStyles();
  const palette = usePalette();

  const router = useRouter();
  return <View style={styles.header}>{back ? <Pressable accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconButton}><Ionicons name="chevron-back" size={21} color={palette.ink} /></Pressable> : <View style={styles.headerSpacer} />}<Text style={styles.headerTitle}>{title}</Text>{action ?? <View style={styles.headerSpacer} />}</View>;
}

export function PrimaryButton({ title, onPress, tone = 'dark', disabled = false }: { title: string; onPress?: () => void; tone?: 'dark' | 'outline'; disabled?: boolean }) {
  const styles = useStyles();

  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, disabled && { opacity: 0.45 }, tone === 'outline' && styles.outlineButton, pressed && styles.pressed]}><Text style={[styles.buttonText, tone === 'outline' && styles.outlineText]}>{title}</Text></Pressable>;
}

export function SectionTitle({ title, action }: { title: string; action?: string }) {
  const styles = useStyles();

  return <View style={styles.sectionTitle}><Text style={styles.sectionText}>{title}</Text>{action ? <Text style={styles.linkText}>{action}</Text> : null}</View>;
}

export function ProgressBar({ value }: { value: number }) {
  return <CompactProgress value={value}/>;
}

export function ToneCard({ tone, children, style }: { tone: Tone; children: ReactNode; style?: object }) {
  const styles = useStyles();

  const palette = usePalette();
  return <View style={[styles.toneCard, { backgroundColor: palette[tone] }, style]}>{children}</View>;
}

export function ModuleCard({ title, subtitle, tone, icon, onPress }: { title: string; subtitle: string; tone: Tone; icon: IconName; onPress?: () => void }) {
  const styles = useStyles();
  const palette = usePalette();

  return <Pressable onPress={onPress} style={({ pressed }) => [styles.moduleCard, { backgroundColor: palette[tone] }, pressed && styles.pressed]}><View style={styles.moduleIcon}><Ionicons name={icon} size={20} color={palette.ink} /></View><View style={styles.moduleCopy}><Text style={styles.moduleTitle}>{title}</Text><Text style={styles.moduleSubtitle}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={18} color={palette.muted} /></Pressable>;
}

export function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, ...inputProps }: TextInputProps & { label: string }) {
  const styles = useStyles();
  const palette = usePalette();

  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={palette.muted} secureTextEntry={secureTextEntry} {...inputProps} style={[styles.input, inputProps.style]} /></View>;
}

export function PasswordField({ label = 'Password', editable = true, ...inputProps }: Omit<TextInputProps, 'secureTextEntry'> & { label?: string }) {
  const styles = useStyles();
  const palette = usePalette();

  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.passwordContainer, !editable && { opacity: 0.6 }]}>
      <TextInput accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} {...inputProps} editable={editable}
        secureTextEntry={!visible} placeholderTextColor={palette.muted} style={[styles.passwordInput, inputProps.style]} />
      <Pressable accessibilityRole="button" accessibilityLabel={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()}
        accessibilityValue={{ text: visible ? 'Visible' : 'Hidden' }} accessibilityState={{ disabled: !editable }} disabled={!editable}
        onPress={() => setVisible(value => !value)} style={styles.passwordToggle}>
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={palette.purple} />
      </Pressable>
    </View>
  </View>;
}
export function BottomNavigation() {
  const styles = useStyles();
  const palette = usePalette();

  const pathname = usePathname();
  const router = useRouter();
  const items: { label: string; icon: IconName; path: string }[] = [
    { label: 'Home', icon: 'home-outline', path: '/dashboard' },
    { label: 'Learn', icon: 'book-outline', path: '/learn' },
    { label: 'Budget', icon: 'wallet-outline', path: '/budget' },
    { label: 'Profile', icon: 'person-outline', path: '/profile' },
  ];
  return <View style={styles.bottomNav}>{items.map((item) => { const active = pathname === item.path || (item.path === '/learn' && pathname.startsWith('/learn')); return <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: active }} onPress={() => router.push(item.path as never)} style={[styles.navItem, active && styles.navItemActive]}><Ionicons name={item.icon} size={19} color={active ? palette.surface : palette.muted} /><Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text></Pressable>; })}</View>;
}

export function StudentShell({ children }: { children: ReactNode }) {
  const commonStyles = useCommonStyles();

  return <View style={commonStyles.page}>{children}<BottomNavigation /></View>;
}

export function ScreenLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href as never} asChild><Pressable>{children}</Pressable></Link>;
}

const useStyles = themedStyles(palette => ({
  header: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { flex: 1, textAlign: 'center', color: palette.ink, fontSize: 16, fontWeight: '500' },
  headerSpacer: { width: 42 },
  iconButton: { width: 42, height: 42, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radii.pill, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  buttonText: { color: palette.surface, fontSize: 13, fontWeight: '500' },
  outlineButton: { borderWidth: 1, borderColor: palette.line, backgroundColor: 'transparent' },
  outlineText: { color: palette.ink },
  pressed: { opacity: 0.76 },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.sm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionText: { color: palette.ink, fontSize: 15, fontWeight: '500' },
  linkText: { color: palette.muted, fontSize: 11, fontWeight: '500' },
  progress: { height: 6, borderRadius: radii.pill, backgroundColor: '#ebe7e9', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: palette.ink },
  toneCard: { borderRadius: radii.md, padding: spacing.md },
  moduleCard: { minHeight: 78, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  moduleIcon: { width: 40, height: 40, borderRadius: radii.pill, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  moduleCopy: { flex: 1 },
  moduleTitle: { color: palette.ink, fontSize: 13, fontWeight: '500' },
  moduleSubtitle: { color: palette.muted, fontSize: 10, marginTop: 4 },
  fieldLabel: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  passwordContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, backgroundColor: palette.surface },
  passwordInput: { flex: 1, minWidth: 0, minHeight: 50, color: palette.ink, paddingHorizontal: 12, fontSize: 15 },
  passwordToggle: { minWidth: 48, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  field: { gap: 5, marginBottom: spacing.sm },
  input: { minHeight: 46, borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, backgroundColor: palette.surface, color: palette.ink, paddingHorizontal: 12, fontSize: 13 },
  bottomNav: { position: 'absolute', left: 12, right: 12, bottom: 10, padding: 6, borderRadius: 22, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, flexDirection: 'row', justifyContent: 'space-around', elevation: 1, shadowColor: '#32232a', shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  navItem: { flex: 1, minWidth: 52, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navItemActive: { backgroundColor: palette.ink },
  navLabel: { color: palette.muted, fontSize: 9 },
  navLabelActive: { color: palette.surface },
}));
