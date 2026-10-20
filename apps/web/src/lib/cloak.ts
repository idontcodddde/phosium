export const CLOAK_OPTIONS = [
  { value: "none", label: "Phosium" },
  { value: "clever", label: "Clever" },
  { value: "desmos", label: "Desmos" },
  { value: "google-classroom", label: "Google Classroom" },
  { value: "google-drive", label: "Google Drive" },
  { value: "google", label: "Google.com" },
  { value: "khan-academy", label: "Khan Academy" },
  { value: "schoology", label: "Schoology" },
] as const;

export type CloakOption = (typeof CLOAK_OPTIONS)[number]["value"];

const CLOAK_METADATA: Partial<Record<CloakOption, { title: string; icon: string }>> = {
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
    icon: "https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/favicon.ico",
  },
};

const DEFAULT_TITLE = "Phosium";
const CLOAK_ICON_ATTRIBUTE = "data-phosium-cloak-icon";

export function isCloakOption(value: string | null): value is CloakOption {
  return CLOAK_OPTIONS.some((option) => option.value === value);
}

export function applyCloak(option: CloakOption): void {
  const metadata = CLOAK_METADATA[option];
  if (!metadata) {
    document.title = DEFAULT_TITLE;
    document.querySelector(`link[${CLOAK_ICON_ATTRIBUTE}]`)?.remove();
    return;
  }

  document.title = metadata.title;
  let iconLink = document.querySelector<HTMLLinkElement>(`link[${CLOAK_ICON_ATTRIBUTE}]`);
  if (!iconLink) {
    iconLink = document.createElement("link");
    iconLink.rel = "icon";
    iconLink.setAttribute(CLOAK_ICON_ATTRIBUTE, "");
    document.head.append(iconLink);
  }
  iconLink.href = metadata.icon;
}
