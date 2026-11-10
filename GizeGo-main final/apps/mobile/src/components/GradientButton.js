import { Pressable, StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors.js";

export function GradientButton({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
      <LinearGradient colors={[colors.buttonStart, colors.buttonEnd]} style={styles.btn}>
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: "center",
  },
  label: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "600",
  },
});
