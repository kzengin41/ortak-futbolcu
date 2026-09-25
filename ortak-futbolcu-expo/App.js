import React, { useState } from "react";
import { SafeAreaView, StatusBar } from "react-native";
import HomeScreen from "./screens/HomeScreen";
import LocalGameScreen from "./screens/LocalGameScreen";
import CpuGameScreen from "./screens/CpuGameScreen";
import OnlineLobbyScreen from "./screens/OnlineLobbyScreen";
import OnlineDuelScreen from "./screens/OnlineDuelScreen";

export default function App() {
  const [screen, setScreen] = useState({ name: "home" });
  const goHome = () => setScreen({ name: "home" });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B1613" }}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1613" />
      {screen.name === "home" && <HomeScreen onSelect={(mode) => setScreen({ name: mode })} />}
      {screen.name === "local" && <LocalGameScreen onExit={goHome} />}
      {screen.name === "cpu" && <CpuGameScreen onExit={goHome} />}
      {screen.name === "onlineLobby" && (
        <OnlineLobbyScreen onExit={goHome} onRoomReady={(room) => setScreen({ name: "onlineDuel", room })} />
      )}
      {screen.name === "onlineDuel" && <OnlineDuelScreen room={screen.room} onExit={goHome} />}
    </SafeAreaView>
  );
}
