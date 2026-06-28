shades=[50,100,200,300,400,500,600,700,800,900,950]
ramps={
 # primary: navy PROFUNDO e SÓBRIO (menos saturado, ~#1B2E6B no 500/600)
 "primary":  ([(96.5,0.012,266),(92.5,0.025,266),(85,0.045,266),(74,0.075,266),(57,0.10,266),(42,0.11,266),(36,0.105,266),(31,0.09,267),(27,0.075,267),(23,0.06,268),(19,0.045,268)],5),
 "secondary":([(96,0.02,256),(92,0.04,256),(85,0.075,256),(77,0.12,255),(68,0.16,255),(57,0.19,256),(50,0.18,257),(44,0.16,258),(39,0.135,259),(34,0.11,260),(29,0.085,261)],5),
 "tertiary": ([(97,0.02,225),(93,0.04,226),(87,0.07,228),(80,0.10,230),(72,0.13,232),(64,0.145,233),(56,0.14,235),(48,0.12,237),(42,0.10,239),(36,0.08,241),(30,0.065,243)],5),
 "success":  ([(96,0.03,160),(92,0.06,160),(86,0.10,159),(79,0.13,158),(72,0.15,157),(64,0.145,156),(56,0.13,157),(48,0.11,158),(42,0.095,159),(37,0.08,160),(31,0.065,161)],6),
 "warning":  ([(97,0.035,85),(94,0.07,84),(90,0.11,83),(86,0.14,82),(83,0.155,80),(80,0.16,78),(72,0.155,75),(64,0.14,72),(56,0.12,70),(48,0.10,68),(40,0.085,66)],7),
 "error":    ([(96,0.02,18),(91,0.05,19),(84,0.09,20),(77,0.13,22),(70,0.17,24),(62,0.195,26),(55,0.18,26),(48,0.16,26),(42,0.14,25),(37,0.12,25),(31,0.10,24)],5),
 "surface":  ([(98.4,0.003,247.858),(96.8,0.007,247.896),(92.9,0.013,255.508),(86.9,0.022,252.894),(70.4,0.04,256.788),(55.4,0.046,257.417),(44.6,0.043,257.281),(37.2,0.044,257.287),(27.9,0.041,260.031),(20.8,0.042,265.755),(12.9,0.042,264.695)],7),
}
def oklch(t): return f"oklch({t[0]}% {t[1]} {t[2]}deg)"
out=["/* Suricatoos theme — 'Corporativo Navy' (navy sóbrio). Inter typography. */","[data-theme='cisotheme'] {"]
base=[("--text-scaling","1.067"),("--base-font-color","var(--color-surface-950)"),("--base-font-color-dark","var(--color-surface-50)"),
 ("--base-font-family","'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"),
 ("--base-font-size","inherit"),("--base-line-height","1.55"),("--base-font-weight","normal"),("--base-font-style","normal"),("--base-letter-spacing","-0.006em"),
 ("--heading-font-color","inherit"),("--heading-font-color-dark","inherit"),("--heading-font-family","'Inter', ui-sans-serif, system-ui, sans-serif"),
 ("--heading-font-weight","700"),("--heading-font-style","normal"),("--heading-letter-spacing","-0.014em"),
 ("--anchor-font-color","var(--color-primary-600)"),("--anchor-font-color-dark","var(--color-primary-400)"),
 ("--anchor-font-family","inherit"),("--anchor-font-size","inherit"),("--anchor-line-height","inherit"),("--anchor-font-weight","500"),
 ("--anchor-font-style","inherit"),("--anchor-letter-spacing","inherit"),("--anchor-text-decoration","none"),("--anchor-text-decoration-hover","underline"),
 ("--anchor-text-decoration-active","none"),("--anchor-text-decoration-focus","none"),("--spacing","0.25rem"),("--radius-base","0.5rem"),("--radius-container","0.75rem"),
 ("--default-border-width","1px"),("--default-divide-width","1px"),("--default-ring-width","1px"),
 ("--body-background-color","var(--color-surface-50)"),("--body-background-color-dark","var(--color-surface-950)")]
for k,v in base: out.append(f"\t{k}: {v};")
for name,(ramp,xover) in ramps.items():
    for i,sh in enumerate(shades): out.append(f"\t--color-{name}-{sh}: {oklch(ramp[i])};")
    out.append(f"\t--color-{name}-contrast-dark: var(--color-{name}-950);")
    out.append(f"\t--color-{name}-contrast-light: var(--color-{name}-50);")
    for i,sh in enumerate(shades):
        out.append(f"\t--color-{name}-contrast-{sh}: var(--color-{name}-contrast-{'light' if i>=xover else 'dark'});")
out.append("}")
out.append("")
out.append("[data-theme='cisotheme'].dark {")
dark=[("--color-surface-700","oklch(34% 0.022 262deg)"),("--color-surface-800","oklch(26% 0.02 263deg)"),("--color-surface-900","oklch(19% 0.018 264deg)"),("--color-surface-950","oklch(14% 0.016 265deg)"),
 ("--anchor-font-color-dark","var(--color-primary-300)"),
 ("--color-primary-300","oklch(80% 0.08 266deg)"),("--color-primary-400","oklch(72% 0.10 266deg)"),("--color-primary-500","oklch(64% 0.11 266deg)"),("--color-primary-600","oklch(56% 0.11 266deg)"),
 ("--color-secondary-400","oklch(74% 0.15 256deg)"),("--color-secondary-500","oklch(66% 0.17 256deg)"),
 ("--color-tertiary-400","oklch(76% 0.12 232deg)"),("--color-tertiary-500","oklch(68% 0.14 233deg)"),
 ("--color-success-500","oklch(70% 0.13 156deg)"),("--color-success-600","oklch(62% 0.12 157deg)"),
 ("--color-warning-500","oklch(80% 0.135 78deg)"),("--color-error-500","oklch(66% 0.17 26deg)"),("--color-error-600","oklch(59% 0.16 26deg)")]
for k,v in dark: out.append(f"\t{k}: {v};")
out.append("}")
open("/root/suricatoos-platform/frontend/ciso-theme.css","w").write("\n".join(out)+"\n")
print("OK regen")
