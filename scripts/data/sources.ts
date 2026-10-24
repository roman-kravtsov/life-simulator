// Every source the pipeline reads, with the licence and edition we rely on (WORLD-001, WORLD-007).
// Access dates come from the download manifest, so they change only when files are re-downloaded.
import type { SourceInfo } from "../../src/engine/world/types";
import { fetched } from "./lib/cache";
import { GHE_FILE } from "./extract/ghe";
import { GDIM_FILE } from "./extract/gdim";
import { GHO_SUICIDE_FILE } from "./extract/gho";
import { ILO_IDS, iloFile } from "./extract/ilostat";
import { PIP_FILE } from "./extract/pip";
import { UIS_FILE } from "./extract/uis";
import { WDI_INDICATORS, wdiFile, wdiLastUpdated } from "./extract/wdi";
import { WPP_FILES } from "./extract/wpp";

/** Bump deliberately when data files are rebuilt from newer downloads. */
export const DATA_VERSION = "2026.10.1";

type Fixed = Omit<SourceInfo, "accessed"> & { files: string[] };

const FIXED: Record<string, Fixed> = {
  wpp: {
    title: "World Population Prospects 2024",
    publisher: "United Nations, Department of Economic and Social Affairs, Population Division",
    url: "https://population.un.org/wpp/",
    licence: "CC BY 3.0 IGO",
    version: "WPP 2024 (estimates to 2023)",
    files: Object.values(WPP_FILES),
  },
  pip: {
    title: "Poverty and Inequality Platform: percentiles (survey years, 2021 PPP)",
    publisher: "World Bank",
    url: "https://datacatalog.worldbank.org/search/dataset/0063646/poverty-and-inequality-platform-pip-percentiles",
    licence: "CC BY 4.0",
    version: "PIP version 20260922",
    files: [PIP_FILE],
  },
  wdi: {
    title:
      "World Development Indicators (urban share, out-of-pocket health spending, child labour, age at first marriage, child marriage)",
    publisher: "World Bank, redistributing series from UN, UNICEF, ILO and WHO",
    url: "https://data.worldbank.org/",
    licence: "CC BY 4.0",
    version: "WDI API, latest value per country, as last updated by the World Bank on {wdiLastUpdated}",
    files: Object.values(WDI_INDICATORS).map(wdiFile),
  },
  gdim: {
    title: "Global Database on Intergenerational Mobility (schooling correlation, 1980 cohort)",
    publisher: "World Bank",
    url: "https://datacatalog.worldbank.org/search/dataset/0050771",
    licence: "CC BY 4.0",
    version: "GDIM 2023-03 (version 3)",
    files: [GDIM_FILE],
  },
  uis: {
    title: "SDG 4 education data (completion, tertiary enrolment, literacy)",
    publisher: "UNESCO Institute for Statistics",
    url: "https://databrowser.uis.unesco.org/",
    licence: "CC BY-SA 3.0 IGO",
    version: "September 2025 release",
    files: [UIS_FILE],
  },
  ilostat: {
    title: "ILOSTAT (labour force participation, unemployment, employment by sector, informal employment)",
    publisher: "International Labour Organization",
    url: "https://ilostat.ilo.org/",
    licence: "CC BY 4.0",
    version: "ILOSTAT bulk API, latest value per country",
    files: Object.values(ILO_IDS).map(iloFile),
  },
  "who-ghe": {
    title: "Global Health Estimates: deaths by cause, age, sex and country",
    publisher: "World Health Organization",
    url: "https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates/ghe-leading-causes-of-death",
    licence: "WHO data terms: free use for public health purposes, with attribution",
    version: "GHE 2023 estimates (workbook of 1 October 2026)",
    files: [GHE_FILE],
  },
  "who-gho": {
    title: "Global Health Observatory: age-standardised suicide rate",
    publisher: "World Health Organization",
    url: "https://www.who.int/data/gho",
    licence: "WHO data terms: free use for public health purposes, with attribution",
    version: "GHO OData API (MH_12)",
    files: [GHO_SUICIDE_FILE],
  },
};

export function sourceInfo(id: string): SourceInfo {
  const { files, ...info } = FIXED[id] ?? fail(id);
  const accessed = files.map((f) => fetched(f).accessed).sort();
  const version = info.version.replace("{wdiLastUpdated}", () => wdiLastUpdated());
  return { ...info, version, accessed: accessed.at(-1)! };
}

function fail(id: string): never {
  throw new Error(`Unknown source "${id}"`);
}

export const SOURCE_IDS = Object.keys(FIXED);
