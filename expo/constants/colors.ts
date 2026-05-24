/**
 * Sawa design tokens.
 * Dark. Premium. Energetic.
 */
const Colors = {
  bg: "#0D0B1E",
  bgElevated: "#15122B",
  card: "#1A1730",
  cardHi: "#221E3D",
  border: "#2A2547",

  text: "#FFFFFF",
  textMuted: "#9B9BB4",
  textDim: "#6B6A86",

  primary: "#FF6B35",
  secondary: "#FF3CAC",
  accent: "#7B2FF7",

  gradient: ["#FF6B35", "#FF3CAC", "#7B2FF7"] as const,
  gradientSoft: ["rgba(255,107,53,0.18)", "rgba(255,60,172,0.16)", "rgba(123,47,247,0.18)"] as const,

  success: "#3DDC97",
  warn: "#FFC857",
  danger: "#FF4D6D",

  radius: 16,

  // legacy template compatibility
  light: {
    text: "#FFFFFF",
    background: "#0D0B1E",
    tint: "#FF6B35",
    tabIconDefault: "#6B6A86",
    tabIconSelected: "#FF6B35",
  },
};

export default Colors;
