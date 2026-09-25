import React, { useRef } from "react";
import { Animated } from "react-native";
import SoundPressable from "../SoundPressable";

// Kartlara "canlı" bir dokunuş hissi katar: basılı tutunca hafifçe küçülür,
// bırakınca yaylanarak eski haline döner. Ses + haptic zaten SoundPressable'da var,
// bu sadece görsel geri bildirimi ekliyor — "premium" hissin büyük kısmı buradan gelir.
export default function PressScale({ children, style, onPress, disabled, ...rest }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <SoundPressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.5 }]}>
        {children}
      </Animated.View>
    </SoundPressable>
  );
}
