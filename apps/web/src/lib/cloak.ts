export const CLOAK_OPTIONS = [
  { value: "none", label: "Phosium" },
  { value: "custom", label: "Custom Cloak..." },
  { value: "clever", label: "Clever" },
  { value: "desmos", label: "Desmos" },
  { value: "google-classroom", label: "Google Classroom" },
  { value: "google-drive", label: "Google Drive" },
  { value: "google", label: "Google.com" },
  { value: "khan-academy", label: "Khan Academy" },
  { value: "schoology", label: "Schoology" },
] as const;

export type CloakOption = (typeof CLOAK_OPTIONS)[number]["value"];

const CLOAK_METADATA: Partial<
  Record<CloakOption, { title: string; icon: string }>
> = {
  clever: {
    title: "Clever | Portal",
    icon: "https://assets.clever.com/launchpad/c4a9bd82e/favicon.ico",
  },
  desmos: {
    title: "Desmos | Beautiful free math.",
    icon: "https://www.desmos.com/favicon.ico",
  },
  "google-classroom": {
    title: "Google Classroom",
    icon: "https://ssl.gstatic.com/classroom/favicon.png",
  },
  "google-drive": {
    title: "Google Drive",
    icon: "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png",
  },
  google: {
    title: "Google",
    icon: "https://www.google.com/favicon.ico",
  },
  "khan-academy": {
    title: "Khan Academy",
    icon: "https://www.khanacademy.org/favicon.ico",
  },
  schoology: {
    title: "Schoology",
    icon:
      "https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/favicon.ico",
  },
};

const DEFAULT_TITLE = "Phosium";
const DEFAULT_REDIRECT = "https://google.com";
const CLOAK_ICON_ATTRIBUTE = "data-phosium-cloak-icon";

interface ResolvedCloak {
  title: string;
  favicon: string;
  redirect: string;
}

export interface CustomCloakConfig {
  title: string;
  favicon: string;
}

export function getCustomCloakConfig(): CustomCloakConfig {
  try {
    return {
      title: localStorage.getItem("phosium_custom_cloak_title") || "Classes",
      favicon: localStorage.getItem("phosium_custom_cloak_icon") ||
        "https://www.google.com/favicon.ico",
    };
  } catch {
    return { title: "Classes", favicon: "https://www.google.com/favicon.ico" };
  }
}

export function setCustomCloakConfig(
  config: Partial<CustomCloakConfig>,
): CustomCloakConfig {
  const current = getCustomCloakConfig();
  const next = { ...current, ...config };
  try {
    if (next.title) {
      localStorage.setItem("phosium_custom_cloak_title", next.title);
    }
    if (next.favicon) {
      localStorage.setItem("phosium_custom_cloak_icon", next.favicon);
    }
    window.dispatchEvent(new Event("phosium:custom-cloak-updated"));
  } catch (err) {
    console.error("Could not save custom cloak config.", err);
  }
  return next;
}

function resolveCloak(preset: string): ResolvedCloak | null {
  if (preset === "custom") {
    const custom = getCustomCloakConfig();
    return {
      title: custom.title,
      favicon: custom.favicon,
      redirect: DEFAULT_REDIRECT,
    };
  }
  if (!isCloakOption(preset)) return null;

  const metadata = CLOAK_METADATA[preset as CloakOption];
  return metadata
    ? {
      title: metadata.title,
      favicon: metadata.icon,
      redirect: DEFAULT_REDIRECT,
    }
    : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

export function isCloakOption(value: string | null): value is CloakOption {
  return CLOAK_OPTIONS.some((option) => option.value === value);
}

export function applyCloak(option: CloakOption, appName = DEFAULT_TITLE): void {
  if (option === "none") {
    document.title = appName;
    document.querySelector(`link[${CLOAK_ICON_ATTRIBUTE}]`)?.remove();
    return;
  }

  const resolved = resolveCloak(option);
  if (!resolved) {
    document.title = appName;
    document.querySelector(`link[${CLOAK_ICON_ATTRIBUTE}]`)?.remove();
    return;
  }

  document.title = resolved.title;
  let iconLink = document.querySelector<HTMLLinkElement>(
    `link[${CLOAK_ICON_ATTRIBUTE}]`,
  );
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.setAttribute(CLOAK_ICON_ATTRIBUTE, "");
    document.head.append(iconLink);
  }
  iconLink.href = resolved.favicon;
}

export async function launchAboutBlank(
  preset: string,
  appName = DEFAULT_TITLE,
): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) return;

  const cloak = resolveCloak(preset);
  const redirect = cloak?.redirect ?? DEFAULT_REDIRECT;
  win.document.title = cloak?.title ?? appName;
  const iframe = win.document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;border:none;margin:0;padding:0;";
  iframe.src = window.location.href;

  win.document.body.style.margin = "0";
  win.document.body.style.overflow = "hidden";
  win.document.body.appendChild(iframe);

  if (cloak) {
    win.document.title = cloak.title;
    const link = win.document.createElement("link");
    link.rel = "shortcut icon";
    link.type = "image/x-icon";
    link.href = cloak.favicon;
    win.document.head.appendChild(link);
  }

  window.location.href = redirect;
}

export async function launchBlob(
  preset: string,
  appName = DEFAULT_TITLE,
): Promise<void> {
  const cloak = resolveCloak(preset);
  const redirect = cloak?.redirect ?? DEFAULT_REDIRECT;
  const title = cloak?.title ?? appName;
  const favicon = cloak?.favicon ?? "/favicon.png";
  const html = `<!DOCTYPE html>
<html>
<head>
<title>${escapeHtml(title)}</title>
<link rel="shortcut icon" type="image/x-icon" href="${escapeHtml(favicon)}">
<style>body,html{margin:0;padding:0;width:100%;height:100%;overflow:hidden}iframe{position:fixed;top:0;left:0;width:100%;height:100%;border:none}</style>
</head>
<body><iframe src="${escapeHtml(window.location.href)}"></iframe></body>
</html>`;

  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const win = window.open(url);
  if (!win) {
    URL.revokeObjectURL(url);
    return;
  }

  win.addEventListener("pagehide", () => URL.revokeObjectURL(url), {
    once: true,
  });
  window.location.href = redirect;
}
