import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, View } from "react-native";
import { LocalizedText as Text } from "@/lib/i18n";

import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import type { ColorScheme } from "@/constants/theme";

const options: { scheme: ColorScheme; label: string; description: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { scheme: "light", label: "Light", description: "Use the bright cooperative palette", icon: "light-mode" },
  { scheme: "dark", label: "Dark", description: "Reduce glare in low light", icon: "dark-mode" },
];

export function AppearanceSetting() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headingRow}>
        <View style={[styles.headingIcon, { backgroundColor: `${colors.primary}20` }]}>
          <MaterialIcons name="palette" size={20} color={colors.primary} />
        </View>
        <View style={styles.copy}>
          <Text translationKey="Appearance" style={[styles.title, { color: colors.foreground }]}>Appearance</Text>
          <Text translationKey="Choose how Cooperative Gig Services looks on this device." style={[styles.subtitle, { color: colors.muted }]}>Choose how Cooperative Gig Services looks on this device.</Text>
        </View>
      </View>
      <View style={styles.options}>
        {options.map((option) => {
          const selected = colorScheme === option.scheme;
          return (
            <Pressable
              key={option.scheme}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label} appearance mode`}
              onPress={() => setColorScheme(option.scheme)}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: selected ? `${colors.primary}16` : "transparent", borderColor: selected ? colors.primary : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons name={option.icon} size={19} color={selected ? colors.primary : colors.muted} />
              <View style={styles.copy}>
                <Text translationKey={option.label} style={[styles.optionLabel, { color: selected ? colors.primary : colors.foreground }]}>{option.label}</Text>
                <Text translationKey={option.description} style={[styles.optionDescription, { color: colors.muted }]}>{option.description}</Text>
              </View>
              <MaterialIcons name={selected ? "radio-button-checked" : "radio-button-unchecked"} size={20} color={selected ? colors.primary : colors.muted} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, marginTop: 14, padding: 14 },
  headingRow: { alignItems: "center", flexDirection: "row", gap: 10 },
  headingIcon: { alignItems: "center", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: "800" },
  subtitle: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  options: { gap: 8, marginTop: 12 },
  option: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 9, minHeight: 54, paddingHorizontal: 11, paddingVertical: 8 },
  optionLabel: { fontSize: 12, fontWeight: "800" },
  optionDescription: { fontSize: 10, marginTop: 2 },
  pressed: { opacity: 0.72 },
});

export default AppearanceSetting;

