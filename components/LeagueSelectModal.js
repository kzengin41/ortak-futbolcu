import React, { useState, useMemo } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { LEAGUE_PRESETS, allLeagues, countryForLeague, clubsForLeagues } from "../lib/leaguePresets";
import { CLUB_INFO } from "../lib/clubs";

import { COLORS } from "../lib/theme";
const COUNTRY_FLAGS = {
  Turkey: "🇹🇷",
  Türkiye: "🇹🇷",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  Germany: "🇩🇪",
  France: "🇫🇷",
};

const PRESET_FLAGS = {
  turkey_top2: "🇹🇷",
  turkey_super: "🇹🇷",
  turkey_all: "🇹🇷",
  top5: "🇬🇧🇪🇸🇩🇪🇮🇹🇫🇷",
  champions: "🏆",
  champions_current: "🏆",
  champions_all_time: "🏆",
  premier: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  all: "🌍",
};

export default function LeagueSelectModal({ visible, currentPreset, onSelect, onClose }) {
  const [selectedLeagues, setSelectedLeagues] = useState([]);
  // Map of excluded clubs by league: { "Süper Lig": ["Fenerbahçe", "Beşiktaş"] }
  const [excludedClubs, setExcludedClubs] = useState({});
  const [expandedLeague, setExpandedLeague] = useState(null);

  const leagues = useMemo(() => allLeagues(CLUB_INFO), []);

  function toggleLeague(l) {
    setSelectedLeagues((prev) => {
      if (prev.includes(l)) {
        const next = prev.filter(x => x !== l);
        const nextExcluded = { ...excludedClubs };
        delete nextExcluded[l];
        setExcludedClubs(nextExcluded);
        if (expandedLeague === l) setExpandedLeague(null);
        return next;
      } else {
        return [...prev, l];
      }
    });
  }

  function toggleClubExclude(l, clubName) {
    setExcludedClubs(prev => {
      const currentExcludes = prev[l] || [];
      if (currentExcludes.includes(clubName)) {
        return { ...prev, [l]: currentExcludes.filter(c => c !== clubName) };
      } else {
        return { ...prev, [l]: [...currentExcludes, clubName] };
      }
    });
  }

  function applyDetailed() {
    if (selectedLeagues.length === 0) return;
    
    // Get all clubs for selected leagues
    let allIncludedClubs = [];
    selectedLeagues.forEach(l => {
      const allClubsForLeague = Object.keys(CLUB_INFO).filter(c => CLUB_INFO[c].league === l);
      const excludes = excludedClubs[l] || [];
      const included = allClubsForLeague.filter(c => !excludes.includes(c));
      allIncludedClubs = allIncludedClubs.concat(included);
    });

    onSelect({ id: `custom:${selectedLeagues.join(",")}`, clubs: allIncludedClubs });
    setSelectedLeagues([]);
    setExcludedClubs({});
    setExpandedLeague(null);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Lig / Kapsam Seç</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeBtn}>Kapat</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.sectionLabel}>Hazır ön ayarlar</Text>
          {LEAGUE_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => { onSelect({ id: p.id }); onClose(); }}
              style={[styles.presetRow, currentPreset === p.id && styles.presetRowActive]}
            >
              <Text style={styles.presetFlag}>{PRESET_FLAGS[p.id] || "⚽"}</Text>
              <Text style={[styles.presetText, currentPreset === p.id && styles.presetTextActive]}>{p.label}</Text>
              {currentPreset === p.id && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          ))}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Kendi seçimini yap</Text>
          <Text style={styles.hint}>İstediğin ligi seç, ardından takımları dilediğin gibi filtrele (tikleri kaldır).</Text>
          
          <View style={styles.leaguesWrap}>
            {leagues.map((l) => {
              const flag = COUNTRY_FLAGS[countryForLeague(l, CLUB_INFO)] || "⚽";
              const isSelected = selectedLeagues.includes(l);
              const isExpanded = expandedLeague === l;
              const allClubsInLeague = Object.keys(CLUB_INFO).filter(c => CLUB_INFO[c].league === l);
              const excludes = excludedClubs[l] || [];

              return (
                <View key={l} style={{ width: "100%", marginBottom: 8 }}>
                  <Pressable
                    onPress={() => toggleLeague(l)}
                    style={[styles.leagueRow, isSelected && styles.leagueRowActive]}
                  >
                    <Text style={[styles.leagueRowText, isSelected && styles.leagueRowTextActive]}>
                      {flag} {l}
                    </Text>
                    {isSelected && (
                      <Pressable 
                        hitSlop={10}
                        style={styles.expandBtn} 
                        onPress={(e) => { e.stopPropagation(); setExpandedLeague(isExpanded ? null : l); }}
                      >
                        <Text style={styles.expandBtnText}>{isExpanded ? "Takımları Gizle" : "Takımları Filtrele"}</Text>
                      </Pressable>
                    )}
                  </Pressable>

                  {isSelected && isExpanded && (
                    <View style={styles.clubsWrap}>
                      {allClubsInLeague.sort().map(clubName => {
                        const isExcluded = excludes.includes(clubName);
                        return (
                          <Pressable 
                            key={clubName} 
                            onPress={() => toggleClubExclude(l, clubName)}
                            style={[styles.clubRow, !isExcluded && styles.clubRowIncluded]}
                          >
                            <Text style={[styles.clubRowText, !isExcluded && styles.clubRowTextIncluded]}>{clubName}</Text>
                            {!isExcluded && <Text style={styles.clubCheck}>✓</Text>}
                          </Pressable>
                        )
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <Pressable
            disabled={selectedLeagues.length === 0}
            onPress={() => { applyDetailed(); onClose(); }}
            style={[styles.applyBtn, selectedLeagues.length === 0 && styles.applyBtnDisabled]}
          >
            <Text style={styles.applyBtnText}>
              {selectedLeagues.length === 0 ? "Önce bir lig seç" : `Uygula (${selectedLeagues.length} lig)`}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 60, paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  closeBtn: { color: COLORS.accent, fontSize: 14, fontWeight: "700" },
  sectionLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 22 },
  presetRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  presetRowActive: { borderColor: COLORS.accent },
  presetFlag: { fontSize: 16, marginRight: 10 },
  presetText: { color: COLORS.text, fontSize: 15, fontWeight: "700", flex: 1 },
  presetTextActive: { color: COLORS.accent },
  checkmark: { color: COLORS.accent, fontSize: 16, fontWeight: "900" },
  hint: { color: COLORS.textMuted, fontSize: 12, marginBottom: 12 },
  
  leaguesWrap: { flexDirection: "column", gap: 0, marginBottom: 16 },
  leagueRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderColor: COLORS.cardBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  leagueRowActive: { borderColor: COLORS.accent, backgroundColor: COLORS.card },
  leagueRowText: { color: COLORS.textMuted, fontSize: 14, fontWeight: "700" },
  leagueRowTextActive: { color: COLORS.accent },
  expandBtn: { backgroundColor: COLORS.bg, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.accent },
  expandBtnText: { color: COLORS.accent, fontSize: 12, fontWeight: "700" },
  
  clubsWrap: { padding: 8, backgroundColor: "#144528", borderBottomLeftRadius: 12, borderBottomRightRadius: 12, marginTop: -8, paddingTop: 16 },
  clubRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  clubRowIncluded: { },
  clubRowText: { color: COLORS.textMuted, fontSize: 13, textDecorationLine: "line-through" },
  clubRowTextIncluded: { color: COLORS.text, fontWeight: "600", textDecorationLine: "none" },
  clubCheck: { color: COLORS.accent, fontSize: 14, fontWeight: "900" },

  applyBtn: { backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  applyBtnDisabled: { backgroundColor: COLORS.cardBorder },
  applyBtnText: { color: COLORS.bg, fontWeight: "900", textTransform: "uppercase", fontSize: 13 },
});
