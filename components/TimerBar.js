import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { COLORS } from "../lib/theme";

export default function TimerBar({ current, total }) {
  const widthAnim = useRef(new Animated.Value(Math.max(0, current / total))).current;

  useEffect(() => {
    // Smooth width transition
    Animated.timing(widthAnim, {
      toValue: Math.max(0, current / total),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [current, total]);

  const color = widthAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ["#FF5D5D", "#FFB020", COLORS.accent]
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.bar, {
        width: widthAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0%", "100%"]
        }),
        backgroundColor: color
      }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 12,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    overflow: "hidden",
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.card,
  },
  bar: {
    height: "100%",
  }
});
