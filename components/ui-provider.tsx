"use client";

import { ConfigProvider, theme as antdTheme, type ThemeConfig } from "antd";

const theme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: "#70e1f5",
    colorInfo: "#70e1f5",
    colorSuccess: "#66d9a5",
    colorError: "#ff8b8b",
    colorBgBase: "#07090d",
    colorBgContainer: "#0f131a",
    colorBgElevated: "#151a23",
    colorText: "#f4f7fb",
    colorTextSecondary: "#a4adba",
    colorTextTertiary: "#6f7887",
    colorBorder: "rgba(255,255,255,0.10)",
    colorBorderSecondary: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    borderRadiusLG: 16,
    controlHeight: 38,
    fontFamily:
      "var(--font-geist-sans), Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  components: {
    Button: {
      defaultBg: "#151a23",
      defaultBorderColor: "rgba(255,255,255,0.13)",
      defaultColor: "#f4f7fb",
      defaultHoverBg: "#191f29",
      defaultHoverBorderColor: "rgba(112,225,245,0.30)",
      defaultHoverColor: "#ffffff",
      textHoverBg: "rgba(255,255,255,0.05)",
    },
    Drawer: {
      colorBgElevated: "#0a0d12",
    },
    Input: {
      activeBorderColor: "transparent",
      activeShadow: "none",
      hoverBorderColor: "transparent",
    },
    Table: {
      headerBg: "#11151c",
      headerColor: "#87909e",
      borderColor: "rgba(255,255,255,0.07)",
      rowHoverBg: "rgba(255,255,255,0.035)",
    },
    Tabs: {
      itemColor: "#87909e",
      itemHoverColor: "#b9f2fb",
      itemSelectedColor: "#70e1f5",
      inkBarColor: "#70e1f5",
    },
  },
};

export function UIProvider({ children }: { children: React.ReactNode }) {
  return <ConfigProvider theme={theme}>{children}</ConfigProvider>;
}
